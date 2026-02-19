import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEmail,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Wholesaler ID (required when admin creates order)',
    example: 'cuid_wholesaler_id',
    required: false,
  })
  @IsOptional()
  @IsString()
  wholesalerId?: string;

  @ApiProperty({
    description: 'Order items',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'number', minimum: 1 },
        unitPrice: { type: 'number', minimum: 0 },
      },
    },
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({
    description: 'Delivery address',
    required: false,
    example: {
      address: '45 Broad Street, Lagos Island',
      city: 'Lagos',
      state: 'Lagos State',
      contactName: 'Wholesale Business Owner',
      contactPhone: '+234801234567',
    },
  })
  @IsOptional()
  deliveryAddress?: any;

  @ApiProperty({
    description: 'Customer notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;
}

export class OrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'cuid_product_id',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantity to order',
    example: 50,
    minimum: 10,
  })
  @IsNumber()
  @Min(10)
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 150.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CheckoutResponseDto {
  @ApiProperty({
    description: 'Order details',
  })
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
  };

  @ApiProperty({
    description: 'Virtual account details for bank transfer',
    type: 'array',
  })
  virtualAccounts: Array<{
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
  }>;

  @ApiProperty({
    description: 'Checkout URL for online payment',
  })
  checkoutUrl: string;

  @ApiProperty({
    description: 'Payment expiry date',
  })
  expiryDate: string;

  @ApiProperty({
    description: 'Invoice reference for tracking',
  })
  invoiceReference: string;
}

export class PaymentConfirmationDto {
  @ApiProperty({
    description: 'Payment confirmation status',
  })
  success: boolean;

  @ApiProperty({
    description: 'Status message',
  })
  message: string;

  @ApiProperty({
    description: 'Payment details if successful',
    required: false,
  })
  paymentDetails?: {
    transactionReference: string;
    amountPaid: number;
    paidOn: string;
    paymentMethod: string;
  };
}

export class UpdateOrderItemStatusDto {
  @ApiProperty({
    description: 'New status for the order item',
    enum: [
      'PENDING',
      'PAID',
      'SOURCING',
      'READY',
      'SHIPPED',
      'DELIVERED',
      'UNAVAILABLE',
      'CANCELLED',
    ],
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({
    description: 'Processing notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  processingNotes?: string;
}
