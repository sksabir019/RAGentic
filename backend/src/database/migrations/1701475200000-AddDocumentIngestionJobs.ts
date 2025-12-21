import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentIngestionJobs1701475200000 implements MigrationInterface {
  name = 'AddDocumentIngestionJobs1701475200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "document_ingestion_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "job_id" character varying NOT NULL,
        "status" character varying NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error_message" text,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_ingestion_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_ingestion_jobs_job_id" UNIQUE ("job_id"),
        CONSTRAINT "FK_document_ingestion_jobs_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_document_ingestion_jobs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query('CREATE INDEX "IDX_document_ingestion_jobs_document_id" ON "document_ingestion_jobs" ("document_id")');
    await queryRunner.query('CREATE INDEX "IDX_document_ingestion_jobs_user_id" ON "document_ingestion_jobs" ("user_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_document_ingestion_jobs_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_document_ingestion_jobs_document_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "document_ingestion_jobs"');
  }
}
