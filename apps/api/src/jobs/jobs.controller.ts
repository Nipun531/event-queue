import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import type { CreateJobDto, ListJobsQueryDto } from "@event-queue/shared-types";

@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  async createJob(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  @Get()
  async findAll(@Query() query: ListJobsQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.jobsService.retry(id);
  }

  @Delete(':id')
  async cancel(@Param('id') id: string) {
    return this.jobsService.cancel(id);
  }
}