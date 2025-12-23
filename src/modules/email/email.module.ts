import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailModule } from '../../common/services/email.module';

@Module({
  imports: [EmailModule],
  controllers: [EmailController],
})
export class EmailTestModule {}
