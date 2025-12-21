import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVectorStore1701388800000 implements MigrationInterface {
  name = 'AddVectorStore1701388800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(
      "ALTER TABLE \"documents\" ADD \"processing_status\" character varying NOT NULL DEFAULT 'pending'"
    );
    await queryRunner.query(
      'ALTER TABLE "documents" ADD "status_message" text'
    );
    await queryRunner.query(
      'ALTER TABLE "document_chunks" ADD "vector_store_id" uuid'
    );

    await queryRunner.query(`
      CREATE TABLE "document_chunk_vectors" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_chunk_id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_chunk_vectors_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_chunk_vectors_chunk" UNIQUE ("document_chunk_id"),
        CONSTRAINT "FK_document_chunk_vectors_chunk" FOREIGN KEY ("document_chunk_id") REFERENCES "document_chunks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_document_chunk_vectors_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_document_chunk_vectors_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_document_chunk_vectors_document_id" ON "document_chunk_vectors" ("document_id")'
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_document_chunk_vectors_user_id" ON "document_chunk_vectors" ("user_id")'
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_document_chunk_vectors_embedding" ON "document_chunk_vectors" USING ivfflat (embedding vector_cosine_ops)'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_document_chunk_vectors_embedding"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_document_chunk_vectors_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_document_chunk_vectors_document_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "document_chunk_vectors"');
    await queryRunner.query('ALTER TABLE "document_chunks" DROP COLUMN "vector_store_id"');
    await queryRunner.query('ALTER TABLE "documents" DROP COLUMN "status_message"');
    await queryRunner.query('ALTER TABLE "documents" DROP COLUMN "processing_status"');
  }
}
