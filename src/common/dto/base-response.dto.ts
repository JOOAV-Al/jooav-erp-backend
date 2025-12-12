import { ApiProperty } from '@nestjs/swagger';

export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

export class BaseResponse<T = any> {
  @ApiProperty({
    description: 'Response status',
    enum: ResponseStatus,
    example: ResponseStatus.SUCCESS,
  })
  status: ResponseStatus;

  @ApiProperty({
    description: 'Response message',
    example: 'Operation successful',
  })
  message: string;

  @ApiProperty({
    description: 'Response data',
    required: false,
  })
  data?: T;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2023-12-08T10:30:00Z',
  })
  timestamp: string;

  constructor(
    message: string,
    data?: T,
    status: ResponseStatus = ResponseStatus.SUCCESS,
  ) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }
}

export class ErrorResponse extends BaseResponse {
  @ApiProperty({
    description: 'Error code',
    example: 'VALIDATION_ERROR',
  })
  code?: string;

  @ApiProperty({
    description: 'Error details',
    required: false,
  })
  errors?: any[];

  constructor(message: string, code?: string, errors?: any[]) {
    super(message, null, ResponseStatus.ERROR);
    this.code = code;
    this.errors = errors;
  }
}
