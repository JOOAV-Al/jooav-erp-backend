import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderItemStatus, ProcurementOfficerStatus } from '@prisma/client';

export class AssignOrderDto {
  @ApiProperty({
    description: 'Procurement officer ID to assign the order to',
    example: 'proc_officer_uuid',
  })
  @IsString()
  @MinLength(1, { message: 'Procurement officer ID cannot be empty' })
  procurementOfficerId: string;

  @ApiPropertyOptional({
    description: 'Assignment notes or special instructions',
    example: 'Urgent order - requires immediate attention',
  })
  @IsOptional()
  @IsString()
  assignmentNotes?: string;
}

export enum AssignmentResponseType {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export class AssignmentResponseDto {
  @ApiProperty({
    description: 'Assignment response - accept or reject',
    enum: AssignmentResponseType,
    example: AssignmentResponseType.ACCEPT,
  })
  @IsEnum(AssignmentResponseType)
  response: AssignmentResponseType;

  @ApiPropertyOptional({
    description: 'Reason for acceptance or rejection',
    example: 'Order accepted - will begin processing immediately',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignmentStatusDto {
  @ApiProperty({
    description: 'Order number',
    example: 'ORD-2026-001',
  })
  orderNumber: string;

  @ApiProperty({
    description: 'Assignment status',
    example: 'PENDING_ACCEPTANCE',
  })
  status: string;

  @ApiProperty({
    description: 'Procurement officer name',
    example: 'John Doe',
  })
  procurementOfficerName: string;

  @ApiProperty({
    description: 'Assignment date',
    example: '2026-02-19T10:30:00Z',
  })
  assignedAt: Date;

  @ApiPropertyOptional({
    description: 'Response date if accepted/rejected',
    example: '2026-02-19T11:15:00Z',
  })
  respondedAt?: Date;

  @ApiPropertyOptional({
    description: 'Assignment notes',
    example: 'Urgent order requiring immediate attention',
  })
  assignmentNotes?: string;

  @ApiPropertyOptional({
    description: 'Response reason',
    example: 'Accepted - will process immediately',
  })
  responseReason?: string;
}

export class BulkUpdateOrderItemDto {
  @ApiProperty({
    description: 'Order item ID',
    example: 'item_uuid_123',
  })
  @IsString()
  @MinLength(1, { message: 'Item ID cannot be empty' })
  itemId: string;

  @ApiProperty({
    description: 'New status for the order item',
    enum: OrderItemStatus,
    example: OrderItemStatus.SOURCING,
  })
  @IsEnum(OrderItemStatus)
  status: OrderItemStatus;

  @ApiPropertyOptional({
    description: 'Processing notes for this item',
    example: 'Item sourced from supplier XYZ',
  })
  @IsOptional()
  @IsString()
  processingNotes?: string;
}

export class BulkUpdateOrderItemsDto {
  @ApiProperty({
    description: 'Array of order items to update',
    type: [BulkUpdateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateOrderItemDto)
  items: BulkUpdateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'General notes for the bulk update',
    example: 'Bulk status update - all items processed',
  })
  @IsOptional()
  @IsString()
  bulkNotes?: string;
}

export class BulkUpdateResultDto {
  @ApiProperty({ description: 'Operation summary message' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Total number of items processed' })
  @IsNumber()
  totalItems: number;

  @ApiProperty({ description: 'Number of successful updates' })
  @IsNumber()
  successCount: number;

  @ApiProperty({ description: 'Number of failed updates' })
  @IsNumber()
  failureCount: number;

  @ApiProperty({
    description: 'Detailed results for each item',
    type: [Object],
  })
  @IsArray()
  results: Array<{
    itemId: string;
    success: boolean;
    message: string;
    updatedItem?: any;
  }>;
}

export class AutoAssignmentConfigDto {
  @ApiProperty({
    description: 'Enable or disable auto-assignment',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Auto-assignment strategy',
    enum: ['availability_based'],
    example: 'availability_based',
  })
  strategy: 'availability_based';

  @ApiProperty({
    description:
      'Maximum number of active orders per officer for auto-assignment',
    example: 10,
  })
  maxActiveOrdersPerOfficer?: number;
}

export class OfficerWorkloadDto {
  @ApiProperty({ description: 'Officer profile ID' })
  officerId: string;

  @ApiProperty({ description: 'Officer name' })
  officerName: string;

  @ApiProperty({ description: 'Number of active orders' })
  activeOrdersCount: number;

  @ApiProperty({ description: 'Number of pending acceptance orders' })
  pendingOrdersCount: number;

  @ApiProperty({ description: 'Officer status' })
  status: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({
    description: 'Procurement officer availability status',
    enum: ProcurementOfficerStatus,
    example: ProcurementOfficerStatus.AVAILABLE,
  })
  @IsEnum(ProcurementOfficerStatus)
  availabilityStatus: ProcurementOfficerStatus;

  @ApiPropertyOptional({
    description: 'Maximum number of active orders (1-20)',
    example: 8,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxActiveOrders?: number;
}

export class AvailabilityStatusDto {
  @ApiProperty({ description: 'Officer profile ID' })
  officerId: string;

  @ApiProperty({ description: 'Officer name' })
  officerName: string;

  @ApiProperty({
    description: 'Current availability status',
    enum: ProcurementOfficerStatus,
  })
  availabilityStatus: ProcurementOfficerStatus;

  @ApiProperty({ description: 'Current active orders count' })
  activeOrdersCount: number;

  @ApiProperty({ description: 'Maximum allowed active orders' })
  maxActiveOrders: number;

  @ApiProperty({ description: 'Last status update' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'User ID for the officer' })
  userId?: string;
}
