import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { XxljobModule } from '../xxljob/xxljob.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [XxljobModule, PermissionsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
