import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseOptionalIntPipe implements PipeTransform<
  string,
  number | undefined
> {
  transform(value: string): number | undefined {
    if (!value) return undefined;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new BadRequestException('Invalid integer format');
    }
    return parsed;
  }
}

@Injectable()
export class ParseOptionalBoolPipe implements PipeTransform<
  string,
  boolean | undefined
> {
  transform(value: string): boolean | undefined {
    if (!value) return undefined;

    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new BadRequestException('Invalid boolean format');
  }
}
