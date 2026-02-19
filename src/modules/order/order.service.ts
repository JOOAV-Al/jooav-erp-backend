import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonnifyService } from '../payment/monnify.service';
import {
  CreateOrderDto,
  UpdateOrderItemStatusDto,
} from './dto/create-order.dto';
import {
  AssignOrderDto,
  AssignmentResponseDto,
  AssignmentResponseType,
  AssignmentStatusDto,
  BulkUpdateOrderItemsDto,
  BulkUpdateResultDto,
  UpdateAvailabilityDto,
  AvailabilityStatusDto,
} from './dto/assignment.dto';
import {
  OrderStatus,
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  AssignmentStatus,
  ProcurementOfficerStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly monnifyService: MonnifyService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create order with Monnify integration
   * Supports both admin and wholesaler order creation
   */
  async createOrder(createOrderDto: CreateOrderDto, userId: string) {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRole = user.role;
    this.logger.log(`Creating order for user ${userId} with role ${userRole}`);

    // Validate permissions
    let targetWholesalerId: string;
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
      if (!createOrderDto.wholesalerId) {
        throw new BadRequestException(
          'Admin must specify wholesaler ID when creating order',
        );
      }
      targetWholesalerId = createOrderDto.wholesalerId;
    } else if (userRole === UserRole.WHOLESALER) {
      // For wholesalers, find their wholesaler record using userId
      const wholesalerProfile = await this.prismaService.wholesaler.findUnique({
        where: { userId: userId },
      });

      if (!wholesalerProfile) {
        throw new NotFoundException('Wholesaler profile not found for user');
      }

      if (
        createOrderDto.wholesalerId &&
        createOrderDto.wholesalerId !== wholesalerProfile.id
      ) {
        throw new ForbiddenException(
          'Wholesaler can only create orders for themselves',
        );
      }
      targetWholesalerId = wholesalerProfile.id;
    } else {
      throw new ForbiddenException(
        'Only admins and wholesalers can create orders',
      );
    }

    // Validate wholesaler exists
    const wholesaler = await this.prismaService.wholesaler.findUnique({
      where: { id: targetWholesalerId },
      include: { user: true },
    });

    if (!wholesaler) {
      throw new NotFoundException('Wholesaler not found');
    }

    // Validate products and calculate total
    const productIds = createOrderDto.items.map((item) => item.productId);
    const products = await this.prismaService.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Some products not found');
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItemsData = createOrderDto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const itemTotal = item.quantity * item.unitPrice;
      totalAmount += itemTotal;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: itemTotal,
        status: OrderItemStatus.PENDING,
        statusUpdatedBy: userId,
      };
    });

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    try {
      // Create Monnify invoice
      const invoiceData = {
        amount: totalAmount,
        invoiceReference: orderNumber,
        customerName:
          wholesaler.user.firstName + ' ' + wholesaler.user.lastName,
        customerEmail: wholesaler.user.email,
        description: `Payment for Order ${orderNumber}`,
        contractCode: this.configService.get('MONNIFY_CONTRACT_CODE'),
        currencyCode: 'NGN',
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        paymentMethods: ['ACCOUNT_TRANSFER', 'CARD'],
        redirectUrl:
          this.configService.get('APP_BASE_URL') +
          `/order/${orderNumber}/payment/success`,
      };

      const monnifyInvoice =
        await this.monnifyService.createInvoice(invoiceData);

      // Adapt to new Monnify response format
      const virtualAccounts = [
        {
          accountNumber: monnifyInvoice.responseBody.accountNumber,
          accountName: monnifyInvoice.responseBody.accountName,
          bankCode: monnifyInvoice.responseBody.bankCode,
          bankName: monnifyInvoice.responseBody.bankName,
        },
      ];

      // Parse the expiry date properly
      const expiryDate = new Date(
        monnifyInvoice.responseBody.expiryDate.replace(' ', 'T'),
      );

      // Create order in database
      const order = await this.prismaService.order.create({
        data: {
          orderNumber,
          wholesalerId: targetWholesalerId,
          status: OrderStatus.DRAFT,
          subtotal: totalAmount, // For now, subtotal equals total
          totalAmount,
          deliveryAddress: createOrderDto.deliveryAddress,
          customerNotes: createOrderDto.customerNotes,
          monnifyInvoiceRef: monnifyInvoice.responseBody.transactionReference,
          virtualAccounts: virtualAccounts,
          checkoutUrl: monnifyInvoice.responseBody.checkoutUrl,
          paymentExpiresAt: expiryDate,
          createdById: userId,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true },
              },
            },
          },
          wholesaler: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `Order ${orderNumber} created successfully with Monnify invoice ${monnifyInvoice.responseBody.transactionReference}`,
      );

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
          status: order.status,
        },
        virtualAccounts: order.virtualAccounts as Array<{
          accountNumber: string;
          accountName: string;
          bankCode: string;
          bankName: string;
        }>,
        checkoutUrl: order.checkoutUrl || '',
        expiryDate: order.paymentExpiresAt?.toISOString() || '',
        invoiceReference: order.monnifyInvoiceRef || '',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create order: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        'Failed to create order and payment invoice',
      );
    }
  }

  /**
   * Verify payment status from Monnify
   */
  async verifyPayment(orderNumber: string, userId: string) {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRole = user.role;
    this.logger.log(
      `Verifying payment for order ${orderNumber} by user ${userId}`,
    );

    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        wholesaler: true,
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (userRole === UserRole.WHOLESALER) {
      // Find the wholesaler profile for this user
      const wholesalerProfile = await this.prismaService.wholesaler.findUnique({
        where: { userId: userId },
      });

      if (!wholesalerProfile) {
        throw new NotFoundException('Wholesaler profile not found for user');
      }

      if (order.wholesalerId !== wholesalerProfile.id) {
        throw new ForbiddenException('You can only verify your own orders');
      }
    } else if (userRole === UserRole.PROCUREMENT_OFFICER) {
      // Procurement officers can only verify payment for orders assigned to them
      if (order.assignedProcurementOfficerId !== userId) {
        throw new ForbiddenException(
          'You can only verify payment for orders assigned to you',
        );
      }
    }

    try {
      // Use the orderNumber as the invoice reference, not the monnify transaction ref
      const invoiceStatus = await this.monnifyService.getInvoiceStatus(
        order.orderNumber,
      );
      if (invoiceStatus.responseBody.paymentStatus === 'PAID') {
        // Check if payment already recorded
        const existingPayment = order.payments.find(
          (p) =>
            p.monnifyInvoiceRef === order.monnifyInvoiceRef &&
            p.status === PaymentStatus.COMPLETED,
        );

        if (!existingPayment) {
          // Record the payment
          await this.recordPayment(order.id, invoiceStatus.responseBody);

          // Update order status
          await this.prismaService.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CONFIRMED },
          });

          // Auto-confirm order items for paid orders
          await this.prismaService.orderItem.updateMany({
            where: {
              orderId: order.id,
              status: OrderItemStatus.PENDING,
            },
            data: {
              status: OrderItemStatus.PAID,
              statusUpdatedAt: new Date(),
              statusUpdatedBy: userId, // Use the actual user ID instead of 'system'
            },
          });

          // Trigger auto-assignment for paid orders
          try {
            await this.autoAssignOrder(order.orderNumber, userId);
            this.logger.log(
              `Auto-assignment triggered for order ${order.orderNumber}`,
            );
          } catch (autoAssignError) {
            // Log but don't fail payment verification if auto-assignment fails
            this.logger.warn(
              `Auto-assignment failed for order ${order.orderNumber}: ${autoAssignError.message}`,
            );
          }
        }

        return {
          success: true,
          message: 'Payment confirmed successfully',
          paymentDetails: {
            transactionReference:
              invoiceStatus.responseBody.transactionReference,
            amountPaid: invoiceStatus.responseBody.amountPaid,
            paidOn: invoiceStatus.responseBody.paidOn,
            paymentMethod: invoiceStatus.responseBody.paymentMethod,
          },
        };
      } else {
        return {
          success: false,
          message: `Payment status: ${invoiceStatus.responseBody.paymentStatus}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to verify payment for order ${orderNumber}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to verify payment status');
    }
  }

  /**
   * Update order item status (admin only)
   */
  async updateOrderItemStatus(
    orderNumber: string,
    itemId: string,
    updateDto: UpdateOrderItemStatusDto,
    userId: string,
  ) {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRole = user.role;

    const orderItem = await this.prismaService.orderItem.findFirst({
      where: {
        id: itemId,
        order: { orderNumber },
      },
      include: {
        order: true,
        product: { select: { name: true } },
      },
    });

    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    // Check permissions
    if (userRole === UserRole.PROCUREMENT_OFFICER) {
      // Procurement officers can only update items for orders assigned to them
      if (orderItem.order.assignedProcurementOfficerId !== userId) {
        throw new ForbiddenException(
          'You can only update items for orders assigned to you',
        );
      }
    } else if (
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only admins or assigned procurement officers can update order item status',
      );
    }

    const updatedItem = await this.prismaService.orderItem.update({
      where: { id: itemId },
      data: {
        status: updateDto.status as OrderItemStatus,
        processingNotes: updateDto.processingNotes,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: userId,
      },
    });

    // Auto-transition order status based on item changes
    await this.updateOrderStatusBasedOnItems(orderItem.order.id, userId);

    this.logger.log(
      `Order item ${itemId} status updated to ${updateDto.status} by admin ${userId}`,
    );

    return {
      success: true,
      message: 'Order item status updated successfully',
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
        processingNotes: updatedItem.processingNotes,
        updatedAt: updatedItem.statusUpdatedAt,
      },
    };
  }

  /**
   * Bulk update order items status
   */
  async bulkUpdateOrderItemsStatus(
    orderNumber: string,
    bulkUpdateDto: BulkUpdateOrderItemsDto,
    userId: string,
  ): Promise<BulkUpdateResultDto> {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get the order
    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                subcategory: true,
              },
            },
          },
        },
        createdBy: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Check access permissions
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role === UserRole.WHOLESALER &&
      order.createdById !== user.id
    ) {
      throw new ForbiddenException('Access denied to this order');
    }

    // Get all requested items to validate they exist and belong to this order
    const existingItems = await this.prismaService.orderItem.findMany({
      where: {
        id: { in: bulkUpdateDto.items.map((item) => item.itemId) },
        orderId: order.id,
      },
      include: {
        product: {
          include: {
            brand: true,
            subcategory: true,
          },
        },
      },
    });

    // Check if all items exist
    const existingItemIds = existingItems.map((item) => item.id);
    const missingItemIds = bulkUpdateDto.items
      .map((item) => item.itemId)
      .filter((id) => !existingItemIds.includes(id));

    if (missingItemIds.length > 0) {
      throw new BadRequestException(
        `Order items not found: ${missingItemIds.join(', ')}`,
      );
    }

    const results: Array<{
      itemId: string;
      success: boolean;
      message: string;
      updatedItem?: any;
    }> = [];

    // Process each item update
    for (const updateItem of bulkUpdateDto.items) {
      try {
        const existingItem = existingItems.find(
          (item) => item.id === updateItem.itemId,
        );

        // Validate procurement officer assignment for restricted statuses
        if (
          user.role === UserRole.PROCUREMENT_OFFICER &&
          Object.values(OrderItemStatus).includes(updateItem.status)
        ) {
          // For now, allow all users to update items (simplified logic)
          // In production, implement proper assignment checking
        }

        // Basic validation
        if (!existingItem) {
          results.push({
            itemId: updateItem.itemId,
            success: false,
            message: 'Item not found',
          });
          continue;
        }

        // Update the item
        const updatedItem = await this.prismaService.orderItem.update({
          where: { id: updateItem.itemId },
          data: {
            status: updateItem.status,
            processingNotes:
              updateItem.processingNotes || existingItem.processingNotes,
            statusUpdatedAt: new Date(),
            statusUpdatedBy: user.id,
          },
          include: {
            product: {
              include: {
                brand: true,
                subcategory: true,
              },
            },
          },
        });

        results.push({
          itemId: updateItem.itemId,
          success: true,
          message: 'Item status updated successfully',
          updatedItem: {
            id: updatedItem.id,
            status: updatedItem.status,
            processingNotes: updatedItem.processingNotes,
            updatedAt: updatedItem.statusUpdatedAt,
          },
        });
      } catch (error) {
        results.push({
          itemId: updateItem.itemId,
          success: false,
          message: error.message || 'Failed to update item status',
        });
      }
    }

    // Update order status based on items (only if all updates succeeded)
    const successfulUpdates = results.filter((result) => result.success);
    if (successfulUpdates.length === bulkUpdateDto.items.length) {
      try {
        await this.updateOrderStatusBasedOnItems(order.id, user.id);
      } catch (error) {
        // Log but don't fail the bulk operation
        console.error('Failed to update order status:', error);
      }
    }

    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.filter((result) => !result.success).length;

    return {
      message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
      totalItems: bulkUpdateDto.items.length,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Get order details with items
   */
  async getOrderDetails(orderNumber: string, userId: string) {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRole = user.role;
    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, brand: true },
            },
            statusUpdatedByUser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        wholesaler: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        payments: {
          where: { status: PaymentStatus.COMPLETED },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (userRole === UserRole.WHOLESALER) {
      // Find the wholesaler profile for this user
      const wholesalerProfile = await this.prismaService.wholesaler.findUnique({
        where: { userId: userId },
      });

      if (!wholesalerProfile) {
        throw new NotFoundException('Wholesaler profile not found for user');
      }

      if (order.wholesalerId !== wholesalerProfile.id) {
        throw new ForbiddenException('You can only view your own orders');
      }
    } else if (userRole === UserRole.PROCUREMENT_OFFICER) {
      // Procurement officers can only view orders assigned to them
      if (order.assignedProcurementOfficerId !== userId) {
        throw new ForbiddenException(
          'You can only view orders assigned to you',
        );
      }
    }

    return order;
  }

  /**
   * List orders with filtering
   */
  async listOrders(userId: string, filters: any = {}) {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userRole = user.role;
    const where: any = {};

    // Apply role-based filtering
    if (userRole === UserRole.WHOLESALER) {
      // Find the wholesaler profile for this user
      const wholesalerProfile = await this.prismaService.wholesaler.findUnique({
        where: { userId: userId },
      });

      if (!wholesalerProfile) {
        throw new NotFoundException('Wholesaler profile not found for user');
      }

      where.wholesalerId = wholesalerProfile.id;
    } else if (userRole === UserRole.PROCUREMENT_OFFICER) {
      // Procurement officers can only see orders assigned to them
      where.assignedProcurementOfficerId = userId;
    }

    // Apply additional filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(filters.fromDate) };
    }

    if (filters.toDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(filters.toDate) };
    }

    const orders = await this.prismaService.order.findMany({
      where,
      include: {
        wholesaler: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            lineTotal: true,
            status: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders;
  }

  /**
   * Handle Monnify webhook
   */
  async handleMonnifyWebhook(webhookData: any) {
    this.logger.log(
      `Processing Monnify webhook for transaction: ${webhookData.transactionReference}`,
    );

    const order = await this.prismaService.order.findFirst({
      where: { monnifyInvoiceRef: webhookData.transactionReference },
    });

    if (!order) {
      this.logger.warn(
        `Order not found for Monnify transaction: ${webhookData.transactionReference}`,
      );
      return { success: false, message: 'Order not found' };
    }

    if (webhookData.paymentStatus === 'PAID') {
      // Check if payment already processed
      const existingPayment = await this.prismaService.payment.findFirst({
        where: {
          orderId: order.id,
          monnifyInvoiceRef: webhookData.transactionReference,
          status: PaymentStatus.COMPLETED,
        },
      });

      if (!existingPayment) {
        await this.prismaService.$transaction(async (tx) => {
          // Record payment
          await tx.payment.create({
            data: {
              orderId: order.id,
              amount: webhookData.amountPaid,
              paymentMethod: this.mapMonnifyPaymentMethod(
                webhookData.paymentMethod,
              ),
              status: PaymentStatus.COMPLETED,
              monnifyInvoiceRef: webhookData.transactionReference,
              transactionRef: webhookData.transactionHash,
              webhookData: webhookData,
            },
          });

          // Update order status
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CONFIRMED },
          });

          // Auto-confirm order items
          await tx.orderItem.updateMany({
            where: {
              orderId: order.id,
              status: OrderItemStatus.PENDING,
            },
            data: {
              status: OrderItemStatus.PAID,
              statusUpdatedAt: new Date(),
              statusUpdatedBy: 'system',
            },
          });
        });

        this.logger.log(
          `Payment processed successfully for order ${order.orderNumber}`,
        );
      }
    }

    return { success: true, message: 'Webhook processed successfully' };
  }

  private async recordPayment(orderId: string, invoiceData: any) {
    return this.prismaService.payment.create({
      data: {
        orderId,
        amount: invoiceData.amountPaid,
        paymentMethod: this.mapMonnifyPaymentMethod(invoiceData.paymentMethod),
        status: PaymentStatus.COMPLETED,
        monnifyInvoiceRef: invoiceData.transactionReference,
        transactionRef: invoiceData.transactionHash,
        webhookData: invoiceData,
      },
    });
  }

  private mapMonnifyPaymentMethod(monnifyMethod: string): PaymentMethod {
    switch (monnifyMethod) {
      case 'ACCOUNT_TRANSFER':
        return PaymentMethod.BANK_TRANSFER;
      case 'CARD':
        return PaymentMethod.CHECKOUT_URL;
      default:
        return PaymentMethod.BANK_TRANSFER;
    }
  }

  private async generateOrderNumber(): Promise<string> {
    const prefix = 'JOO';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Auto-transition order status based on item statuses
   */
  private async updateOrderStatusBasedOnItems(orderId: string, userId: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    const items = order.items;

    // Auto-transition to IN_PROGRESS when officer first updates any item (only if assignment accepted)
    if (
      order.status === OrderStatus.ASSIGNED &&
      order.assignmentStatus === AssignmentStatus.ACCEPTED
    ) {
      await this.prismaService.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.IN_PROGRESS },
      });
      this.logger.log(
        `Order ${order.orderNumber} auto-transitioned to IN_PROGRESS`,
      );
      return;
    }

    // Auto-transition to COMPLETED when all items are delivered
    const allDelivered = items.every(
      (item) => item.status === OrderItemStatus.DELIVERED,
    );
    if (allDelivered && order.status === OrderStatus.IN_PROGRESS) {
      await this.prismaService.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });
      this.logger.log(
        `Order ${order.orderNumber} auto-completed - all items delivered`,
      );
    }
  }

  /**
   * Auto-assign order based on procurement officer availability
   * Assigns to officer with least active orders
   */
  async autoAssignOrder(
    orderNumber: string,
    triggeredByUserId: string,
  ): Promise<AssignmentStatusDto | null> {
    // Check if auto-assignment is enabled (you can make this configurable)
    const autoAssignEnabled =
      this.configService.get('AUTO_ASSIGN_ENABLED', 'true') === 'true';
    if (!autoAssignEnabled) {
      this.logger.log('Auto-assignment is disabled');
      return null;
    }

    // Get the order
    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
        assignedProcurementOfficer: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only auto-assign confirmed, paid orders that aren't already assigned
    if (order.status !== OrderStatus.CONFIRMED) {
      this.logger.log(
        `Order ${orderNumber} is not confirmed, skipping auto-assignment`,
      );
      return null;
    }

    if (order.payments.length === 0) {
      this.logger.log(
        `Order ${orderNumber} is not paid, skipping auto-assignment`,
      );
      return null;
    }

    if (order.assignedProcurementOfficerId) {
      this.logger.log(
        `Order ${orderNumber} already assigned, skipping auto-assignment`,
      );
      return null;
    }

    // Find available procurement officer with least workload
    const availableOfficer = await this.findMostAvailableOfficer();

    if (!availableOfficer) {
      this.logger.warn('No available procurement officers for auto-assignment');
      return null;
    }

    // Auto-assign the order
    const updatedOrder = await this.prismaService.order.update({
      where: { orderNumber },
      data: {
        assignedProcurementOfficerId: availableOfficer.id,
        assignmentStatus: AssignmentStatus.PENDING_ACCEPTANCE,
        assignedAt: new Date(),
        assignmentNotes: 'Auto-assigned based on availability',
        assignmentRespondedAt: null,
        assignmentResponseReason: null,
      },
    });

    this.logger.log(
      `Order ${orderNumber} auto-assigned to ${availableOfficer.user.firstName} ${availableOfficer.user.lastName} (${availableOfficer.activeOrdersCount} active orders)`,
    );

    return {
      orderNumber: updatedOrder.orderNumber,
      status: AssignmentStatus.PENDING_ACCEPTANCE,
      procurementOfficerName: `${availableOfficer.user.firstName} ${availableOfficer.user.lastName}`,
      assignedAt: updatedOrder.assignedAt!,
      assignmentNotes: updatedOrder.assignmentNotes || undefined,
    };
  }

  /**
   * Find procurement officer with least active orders
   * @param excludeUserId - User ID to exclude from selection (e.g., officer who rejected)
   */
  private async findMostAvailableOfficer(excludeUserId?: string) {
    const officers =
      await this.prismaService.procurementOfficerProfile.findMany({
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          assignedOrders: {
            where: {
              status: {
                in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
              },
              assignmentStatus: {
                in: [
                  AssignmentStatus.PENDING_ACCEPTANCE,
                  AssignmentStatus.ACCEPTED,
                ],
              },
            },
            select: { id: true },
          },
        },
        where: {
          user: {
            status: 'ACTIVE', // User account must be active
          },
          // Officer must be available for new assignments
          availabilityStatus: ProcurementOfficerStatus.AVAILABLE,
          // Exclude the specified user if provided (by userId)
          ...(excludeUserId && {
            userId: {
              not: excludeUserId,
            },
          }),
        },
      });

    if (officers.length === 0) {
      return null;
    }

    // Filter officers who haven't exceeded their maximum active orders
    const availableOfficers = officers.filter((officer) => {
      const activeOrders = officer.assignedOrders.length;
      const maxOrders = officer.maxActiveOrders || 5; // Default to 5 if not set
      return activeOrders < maxOrders;
    });

    if (availableOfficers.length === 0) {
      this.logger.warn(
        'No officers available - all have reached their maximum active orders',
      );
      return null;
    }

    // Calculate workload and find least busy officer
    const officersWithWorkload = availableOfficers.map((officer) => ({
      ...officer,
      activeOrdersCount: officer.assignedOrders.length,
    }));

    // Sort by active orders count (ascending), then by user ID for consistency
    officersWithWorkload.sort((a, b) => {
      if (a.activeOrdersCount !== b.activeOrdersCount) {
        return a.activeOrdersCount - b.activeOrdersCount;
      }
      return a.user.id.localeCompare(b.user.id);
    });

    return officersWithWorkload[0];
  }

  /**
   * Assign order to procurement officer (Admin only)
   * Supports both initial assignment and reassignment (admin override)
   */
  async assignOrder(
    orderNumber: string,
    assignDto: AssignOrderDto,
    adminId: string,
  ): Promise<AssignmentStatusDto> {
    // Verify admin permissions
    const admin = await this.prismaService.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true, firstName: true, lastName: true },
    });

    if (
      !admin ||
      (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Only admins can assign orders');
    }

    // Find the order
    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
        assignedProcurementOfficer: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate order is ready for assignment (confirmed and paid)
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed orders can be assigned');
    }

    if (order.payments.length === 0) {
      throw new BadRequestException('Order must be paid before assignment');
    }

    // Verify procurement officer exists
    const procurementOfficer =
      await this.prismaService.procurementOfficerProfile.findUnique({
        where: { id: assignDto.procurementOfficerId },
        include: {
          user: { select: { firstName: true, lastName: true, status: true } },
        },
      });

    if (!procurementOfficer) {
      throw new NotFoundException('Procurement officer not found');
    }

    if (procurementOfficer.user.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot assign to inactive procurement officer',
      );
    }

    // Check if this is a reassignment (order was previously assigned)
    const isReassignment = order.assignedProcurementOfficerId !== null;
    const previousOfficer = order.assignedProcurementOfficer;

    // For reassignment, log the change
    if (isReassignment && previousOfficer) {
      this.logger.log(
        `Admin override: Order ${orderNumber} reassigned from ${previousOfficer.user.firstName} ${previousOfficer.user.lastName} to ${procurementOfficer.user.firstName} ${procurementOfficer.user.lastName} by admin ${admin.firstName} ${admin.lastName}`,
      );
    }

    // Update order with assignment
    const updatedOrder = await this.prismaService.order.update({
      where: { orderNumber },
      data: {
        assignedProcurementOfficerId: assignDto.procurementOfficerId,
        assignmentStatus: isReassignment
          ? AssignmentStatus.REASSIGNED
          : AssignmentStatus.PENDING_ACCEPTANCE,
        assignedAt: new Date(),
        assignmentNotes:
          assignDto.assignmentNotes ||
          (isReassignment ? 'Reassigned by admin' : undefined),
        assignmentRespondedAt: null, // Reset response when reassigning
        assignmentResponseReason: null, // Reset response reason when reassigning
        // Order status remains CONFIRMED until officer accepts
      },
    });

    const assignmentStatus = isReassignment
      ? AssignmentStatus.REASSIGNED
      : AssignmentStatus.PENDING_ACCEPTANCE;

    const logMessage = isReassignment
      ? `Order ${orderNumber} reassigned to ${procurementOfficer.user.firstName} ${procurementOfficer.user.lastName} by admin ${admin.firstName} ${admin.lastName}`
      : `Order ${orderNumber} assigned to ${procurementOfficer.user.firstName} ${procurementOfficer.user.lastName} by admin ${admin.firstName} ${admin.lastName}`;

    this.logger.log(logMessage);

    return {
      orderNumber: updatedOrder.orderNumber,
      status: assignmentStatus,
      procurementOfficerName: `${procurementOfficer.user.firstName} ${procurementOfficer.user.lastName}`,
      assignedAt: updatedOrder.assignedAt!,
      assignmentNotes: updatedOrder.assignmentNotes || undefined,
    };
  }

  /**
   * Procurement officer responds to assignment
   */
  async respondToAssignment(
    orderNumber: string,
    responseDto: AssignmentResponseDto,
    userId: string,
  ): Promise<AssignmentStatusDto> {
    // Verify user is procurement officer
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, firstName: true, lastName: true },
    });

    if (!user || user.role !== UserRole.PROCUREMENT_OFFICER) {
      throw new ForbiddenException(
        'Only procurement officers can respond to assignments',
      );
    }

    // Find the order
    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        assignedProcurementOfficer: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify this officer is assigned to the order
    if (order.assignedProcurementOfficerId !== userId) {
      throw new ForbiddenException('You are not assigned to this order');
    }

    // Verify assignment is pending or reassigned
    if (
      order.assignmentStatus !== AssignmentStatus.PENDING_ACCEPTANCE &&
      order.assignmentStatus !== AssignmentStatus.REASSIGNED
    ) {
      throw new BadRequestException('Assignment has already been responded to');
    }

    const newAssignmentStatus =
      responseDto.response === AssignmentResponseType.ACCEPT
        ? AssignmentStatus.ACCEPTED
        : AssignmentStatus.REJECTED;

    // Only change order status to ASSIGNED when officer accepts
    const newOrderStatus =
      responseDto.response === AssignmentResponseType.ACCEPT
        ? OrderStatus.ASSIGNED // Officer accepted - now actively assigned
        : order.status; // Keep current status (CONFIRMED) if rejected

    // If rejecting, clear assignment
    const updateData: any = {
      assignmentStatus: newAssignmentStatus,
      assignmentRespondedAt: new Date(),
      assignmentResponseReason: responseDto.reason,
      status: newOrderStatus,
    };

    if (responseDto.response === AssignmentResponseType.REJECT) {
      updateData.assignedProcurementOfficerId = null;
      updateData.assignmentStatus = AssignmentStatus.REJECTED;
      // Order status stays CONFIRMED for reassignment
    }

    const updatedOrder = await this.prismaService.order.update({
      where: { orderNumber },
      data: updateData,
    });

    this.logger.log(
      `Order ${orderNumber} ${responseDto.response.toLowerCase()}ed by ${user.firstName} ${user.lastName}`,
    );

    // If officer rejected the assignment, trigger automatic reassignment
    if (responseDto.response === AssignmentResponseType.REJECT) {
      try {
        this.logger.log(
          `Triggering automatic reassignment for rejected order ${orderNumber}`,
        );

        // Use setTimeout to ensure response is sent first, then trigger reassignment asynchronously
        setTimeout(async () => {
          try {
            await this.autoReassignAfterRejection(orderNumber, userId);
          } catch (reassignError) {
            this.logger.error(
              `Failed to auto-reassign order ${orderNumber} after rejection: ${reassignError.message}`,
              reassignError.stack,
            );
          }
        }, 100); // Small delay to ensure response is sent
      } catch (error) {
        // Log but don't fail the response - rejection should still be recorded
        this.logger.warn(
          `Auto-reassignment scheduling failed for order ${orderNumber}: ${error.message}`,
        );
      }
    }

    return {
      orderNumber: updatedOrder.orderNumber,
      status: newAssignmentStatus,
      procurementOfficerName: `${user.firstName} ${user.lastName}`,
      assignedAt: updatedOrder.assignedAt!,
      respondedAt: updatedOrder.assignmentRespondedAt!,
      assignmentNotes: updatedOrder.assignmentNotes || undefined,
      responseReason: updatedOrder.assignmentResponseReason || undefined,
    };
  }

  /**
   * Auto-reassign order after rejection with proper checks
   */
  private async autoReassignAfterRejection(
    orderNumber: string,
    rejectedByUserId: string,
  ): Promise<void> {
    try {
      // Check if auto-assignment is enabled
      const autoAssignEnabled =
        this.configService.get('AUTO_ASSIGN_ENABLED', 'true') === 'true';
      if (!autoAssignEnabled) {
        this.logger.log(`Auto-reassignment disabled for order ${orderNumber}`);
        return;
      }

      // Check if auto-reassignment after rejection is enabled
      const autoReassignEnabled =
        this.configService.get('AUTO_REASSIGN_AFTER_REJECTION', 'true') ===
        'true';
      if (!autoReassignEnabled) {
        this.logger.log(
          `Auto-reassignment after rejection disabled for order ${orderNumber}`,
        );
        return;
      }

      // Get maximum reassignment attempts
      const maxReassignAttempts = parseInt(
        this.configService.get('MAX_REASSIGN_ATTEMPTS', '3'),
      );

      // Get the current state of the order to ensure it's still rejected
      const order = await this.prismaService.order.findUnique({
        where: { orderNumber },
        include: {
          payments: { where: { status: PaymentStatus.COMPLETED } },
        },
      });

      if (!order) {
        this.logger.warn(
          `Order ${orderNumber} not found during auto-reassignment`,
        );
        return;
      }

      // Count previous rejections by checking assignment notes
      // This is a simple approach - in production, you might want a dedicated assignment history table
      const assignmentNotesHistory = order.assignmentNotes || '';
      const rejectionMatches = assignmentNotesHistory.match(
        /Auto-reassigned after rejection/g,
      );
      const rejectionCount = rejectionMatches ? rejectionMatches.length : 0;

      if (rejectionCount >= maxReassignAttempts) {
        this.logger.warn(
          `Order ${orderNumber} has reached maximum reassignment attempts (${maxReassignAttempts}). Manual intervention required.`,
        );
        // Mark order for manual intervention
        await this.prismaService.order.update({
          where: { orderNumber },
          data: {
            assignmentNotes: `${assignmentNotesHistory} | Maximum auto-reassignment attempts reached (${rejectionCount + 1}). Manual assignment required.`,
          },
        });
        return;
      }

      // Safety checks before reassignment
      if (order.assignmentStatus !== AssignmentStatus.REJECTED) {
        this.logger.log(
          `Order ${orderNumber} is no longer in rejected status, skipping auto-reassignment`,
        );
        return;
      }

      if (order.assignedProcurementOfficerId !== null) {
        this.logger.log(
          `Order ${orderNumber} has been manually reassigned, skipping auto-reassignment`,
        );
        return;
      }

      if (order.status !== OrderStatus.CONFIRMED) {
        this.logger.log(
          `Order ${orderNumber} is not in confirmed status, skipping auto-reassignment`,
        );
        return;
      }

      if (order.payments.length === 0) {
        this.logger.log(
          `Order ${orderNumber} is not paid, skipping auto-reassignment`,
        );
        return;
      }

      // Find an available officer (excluding the one who rejected)
      const availableOfficer =
        await this.findMostAvailableOfficer(rejectedByUserId);

      if (!availableOfficer) {
        this.logger.warn(
          `No available procurement officers for auto-reassignment of order ${orderNumber}`,
        );
        return;
      }

      // Auto-reassign the order
      const updatedOrder = await this.prismaService.order.update({
        where: { orderNumber },
        data: {
          assignedProcurementOfficerId: availableOfficer.id,
          assignmentStatus: AssignmentStatus.REASSIGNED,
          assignedAt: new Date(),
          assignmentNotes: `${order.assignmentNotes || ''} | Auto-reassigned after rejection (attempt ${rejectionCount + 1}/${maxReassignAttempts})`,
          assignmentRespondedAt: null,
          assignmentResponseReason: null,
        },
      });

      this.logger.log(
        `Order ${orderNumber} auto-reassigned to ${availableOfficer.user.firstName} ${availableOfficer.user.lastName} after rejection (${availableOfficer.activeOrdersCount} active orders)`,
      );

      // Optional: Send notification to the new officer about the reassignment
      // You can implement this based on your notification system
    } catch (error) {
      this.logger.error(
        `Critical error in auto-reassignment for order ${orderNumber}: ${error.message}`,
        error.stack,
      );
      // Don't throw error to avoid affecting the main flow
    }
  }

  /**
   * Get assignment status for an order
   */
  async getAssignmentStatus(
    orderNumber: string,
    userId: string,
  ): Promise<AssignmentStatusDto> {
    // Get user and their role
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.prismaService.order.findUnique({
      where: { orderNumber },
      include: {
        assignedProcurementOfficer: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (user.role === UserRole.PROCUREMENT_OFFICER) {
      if (order.assignedProcurementOfficerId !== userId) {
        throw new ForbiddenException(
          'You can only view assignment status for orders assigned to you',
        );
      }
    }

    if (!order.assignedProcurementOfficer) {
      throw new BadRequestException(
        'Order has not been assigned to any procurement officer',
      );
    }

    return {
      orderNumber: order.orderNumber,
      status: order.assignmentStatus || AssignmentStatus.UNASSIGNED,
      procurementOfficerName: `${order.assignedProcurementOfficer.user.firstName} ${order.assignedProcurementOfficer.user.lastName}`,
      assignedAt: order.assignedAt!,
      respondedAt: order.assignmentRespondedAt || undefined,
      assignmentNotes: order.assignmentNotes || undefined,
      responseReason: order.assignmentResponseReason || undefined,
    };
  }

  /**
   * Get workload dashboard for all procurement officers (Admin only)
   */
  async getOfficerWorkloads(): Promise<
    Array<{
      officerId: string;
      officerName: string;
      activeOrdersCount: number;
      pendingOrdersCount: number;
      status: string;
    }>
  > {
    const officers =
      await this.prismaService.procurementOfficerProfile.findMany({
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          assignedOrders: {
            where: {
              assignmentStatus: {
                in: [
                  AssignmentStatus.PENDING_ACCEPTANCE,
                  AssignmentStatus.ACCEPTED,
                  AssignmentStatus.REASSIGNED,
                ],
              },
            },
            select: {
              id: true,
              status: true,
              assignmentStatus: true,
            },
          },
        },
      });

    return officers.map((officer) => {
      const activeOrders = officer.assignedOrders.filter(
        (order) =>
          order.assignmentStatus === AssignmentStatus.ACCEPTED &&
          (order.status === OrderStatus.ASSIGNED ||
            order.status === OrderStatus.IN_PROGRESS),
      );

      const pendingOrders = officer.assignedOrders.filter(
        (order) =>
          order.assignmentStatus === AssignmentStatus.PENDING_ACCEPTANCE ||
          order.assignmentStatus === AssignmentStatus.REASSIGNED,
      );

      return {
        officerId: officer.id,
        officerName: `${officer.user.firstName} ${officer.user.lastName}`,
        activeOrdersCount: activeOrders.length,
        pendingOrdersCount: pendingOrders.length,
        status: officer.user.status,
      };
    });
  }

  /**
   * Get orders that need manual intervention (Admin only)
   * Returns orders that have reached maximum auto-reassignment attempts
   */
  async getOrdersNeedingManualIntervention(): Promise<
    Array<{
      orderNumber: string;
      wholesalerName: string;
      totalAmount: number;
      assignmentNotes: string;
      createdAt: Date;
    }>
  > {
    const orders = await this.prismaService.order.findMany({
      where: {
        assignmentStatus: AssignmentStatus.REJECTED,
        assignmentNotes: {
          contains: 'Manual assignment required',
        },
      },
      include: {
        wholesaler: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((order) => ({
      orderNumber: order.orderNumber,
      wholesalerName: `${order.wholesaler.user.firstName} ${order.wholesaler.user.lastName}`,
      totalAmount: Number(order.totalAmount),
      assignmentNotes: order.assignmentNotes || '',
      createdAt: order.createdAt,
    }));
  }

  /**
   * Update procurement officer availability status (Officer only)
   */
  async updateOfficerAvailability(
    userId: string,
    updateDto: UpdateAvailabilityDto,
  ): Promise<AvailabilityStatusDto> {
    // Verify user is procurement officer
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== UserRole.PROCUREMENT_OFFICER) {
      throw new ForbiddenException(
        'Only procurement officers can update their availability',
      );
    }

    // Find the officer profile
    const officerProfile =
      await this.prismaService.procurementOfficerProfile.findUnique({
        where: { userId },
      });

    if (!officerProfile) {
      throw new NotFoundException('Procurement officer profile not found');
    }

    // Update availability
    const updatedProfile =
      await this.prismaService.procurementOfficerProfile.update({
        where: { userId },
        data: {
          availabilityStatus: updateDto.availabilityStatus,
          maxActiveOrders:
            updateDto.maxActiveOrders || officerProfile.maxActiveOrders,
        },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
          assignedOrders: {
            where: {
              status: {
                in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
              },
              assignmentStatus: {
                in: [
                  AssignmentStatus.PENDING_ACCEPTANCE,
                  AssignmentStatus.ACCEPTED,
                ],
              },
            },
            select: { id: true },
          },
        },
      });

    this.logger.log(
      `Procurement officer ${updatedProfile.user.firstName} ${updatedProfile.user.lastName} updated availability to ${updateDto.availabilityStatus}`,
    );

    return {
      officerId: updatedProfile.id,
      officerName: `${updatedProfile.user.firstName} ${updatedProfile.user.lastName}`,
      availabilityStatus: updatedProfile.availabilityStatus,
      activeOrdersCount: updatedProfile.assignedOrders.length,
      maxActiveOrders: updatedProfile.maxActiveOrders,
      updatedAt: updatedProfile.updatedAt,
    };
  }

  /**
   * Get procurement officer availability status
   */
  async getOfficerAvailability(userId: string) {
    // Get the officer profile
    const officerProfile =
      await this.prismaService.procurementOfficerProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: { firstName: true, lastName: true, role: true },
          },
          assignedOrders: {
            where: {
              status: {
                in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
              },
              assignmentStatus: {
                in: [
                  AssignmentStatus.PENDING_ACCEPTANCE,
                  AssignmentStatus.ACCEPTED,
                ],
              },
            },
            select: { id: true },
          },
        },
      });

    if (!officerProfile) {
      throw new NotFoundException('Procurement officer profile not found');
    }

    return {
      officerId: officerProfile.id,
      officerName: `${officerProfile.user.firstName} ${officerProfile.user.lastName}`,
      availabilityStatus: officerProfile.availabilityStatus,
      activeOrdersCount: officerProfile.assignedOrders.length,
      maxActiveOrders: officerProfile.maxActiveOrders,
      updatedAt: officerProfile.updatedAt,
    };
  }

  /**
   * Get all procurement officers availability status (Admin only)
   */
  async getAllOfficersAvailability() {
    const officerProfiles =
      await this.prismaService.procurementOfficerProfile.findMany({
        include: {
          user: {
            select: { firstName: true, lastName: true, role: true },
          },
          assignedOrders: {
            where: {
              status: {
                in: [OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
              },
              assignmentStatus: {
                in: [
                  AssignmentStatus.PENDING_ACCEPTANCE,
                  AssignmentStatus.ACCEPTED,
                ],
              },
            },
            select: { id: true },
          },
        },
      });

    return officerProfiles.map((profile) => ({
      userId: profile.userId,
      officerId: profile.id,
      officerName: `${profile.user.firstName} ${profile.user.lastName}`,
      availabilityStatus: profile.availabilityStatus,
      activeOrdersCount: profile.assignedOrders.length,
      maxActiveOrders: profile.maxActiveOrders,
      updatedAt: profile.updatedAt,
    }));
  }
}
