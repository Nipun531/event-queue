import { Controller,Get, Post,Body,Param } from '@nestjs/common';
import { QueuesService } from './queue.service';
import type { CreateQueueDto } from '@event-queue/shared-types';

// Explanation of what each file does and why
// queues.controller.ts
// Handles the HTTP layer only. It receives the request, extracts the data from the body, passes it to the service, and returns the response. No database logic, no business logic. Controllers are thin by design — if someone reads the controller they should immediately understand what routes exist and what data they accept. Nothing more.
// queues.service.ts
// Handles the actual work. Talks to the database via PrismaService. Contains all the business logic — validating the queue name format, checking for duplicates, computing the depth count. The reason logic lives here and not in the controller: if you later want to create a queue from a different place (a CLI script, a webhook, a scheduled task) you call the service directly without duplicating the logic.
// queues.module.ts
// Wires the controller and service together. Tells NestJS: "this module owns QueueController and QueuesService, and it needs PrismaModule to work". Without the module, NestJS does not know QueueController and QueuesService exist.

@Controller('v1/queues')
export class QueueController {
  constructor(private readonly queuesService: QueuesService) {}

  @Post()
  async create(@Body() dto: CreateQueueDto) {
    return this.queuesService.create(dto);
  }

  @Get()
  async findAll() {
    return this.queuesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.queuesService.findOne(id);
  }
}


// **Why these three APIs exist and what they do in the broader system**

// ---

// **POST /v1/queues**

// Creates a named queue with its configuration. This must exist before any job can be submitted because the job submission endpoint (T9) looks up the queue by name to validate it exists and read its concurrency and retry settings. A queue is a configuration object — it defines the rules for all jobs that flow through it. The emails queue might allow 10 concurrent jobs. The reports queue might allow only 2. Without creating the queue first, you have nowhere to send jobs.

// ---

// **GET /v1/queues**

// Returns all queues with their current depth — how many jobs are sitting pending in each one. This is what the dashboard uses in Phase 6 to show you the health of your system at a glance. A queue with depth 0 is idle. A queue with depth 500 means work is piling up faster than workers can process it — something is wrong. The depth is computed live from a COUNT query on the jobs table every time this endpoint is called.

// ---

// **GET /v1/queues/:id**

// Returns a single queue with its depth. Used by the dashboard when you click into a specific queue to see its configuration and current state. Also used internally when you need to validate that a specific queue exists before performing an operation on it.

// ---

// **The bigger picture**

// These three endpoints together give you the ability to define the channels your system operates on. In a real deployment you would create queues once during setup — emails, images, reports, notifications — and they persist forever. Jobs flow through them continuously. The queue is the contract between whoever submits jobs and the workers that execute them.