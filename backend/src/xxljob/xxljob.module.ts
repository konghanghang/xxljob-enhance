import { Module } from '@nestjs/common';
import { XxlJobService } from './xxljob.service';

@Module({
  providers: [XxlJobService],
  exports: [XxlJobService],
})
export class XxljobModule {}
