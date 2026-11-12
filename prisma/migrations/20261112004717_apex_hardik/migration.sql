-- CreateTable
CREATE TABLE "runs" (
    "id" VARCHAR(36) NOT NULL,
    "ownerHash" VARCHAR(64) NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "prepId" VARCHAR(36),
    "idempotencyKey" VARCHAR(64),
    "mode" VARCHAR(16) NOT NULL,
    "text" TEXT NOT NULL,
    "question" TEXT,
    "context" JSONB NOT NULL,
    "parentRunId" VARCHAR(36),
    "state" VARCHAR(16) NOT NULL,
    "graphVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "nextEventSeq" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preparations" (
    "id" VARCHAR(36) NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "claimTickets" JSONB NOT NULL,
    "qualifiers" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preparations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" VARCHAR(36) NOT NULL,
    "runId" VARCHAR(36) NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "qualifiers" JSONB,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" VARCHAR(36) NOT NULL,
    "runId" VARCHAR(36) NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "domain" VARCHAR(255),
    "rawContent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_units" (
    "id" VARCHAR(36) NOT NULL,
    "sourceDocId" VARCHAR(36) NOT NULL,
    "content" TEXT NOT NULL,
    "quote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_evidence_assessments" (
    "id" VARCHAR(36) NOT NULL,
    "claimId" VARCHAR(36) NOT NULL,
    "evidenceUnitId" VARCHAR(36) NOT NULL,
    "stance" VARCHAR(24) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_evidence_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_records" (
    "id" VARCHAR(36) NOT NULL,
    "claimId" VARCHAR(36) NOT NULL,
    "verdict" VARCHAR(32) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "reasoning" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_events" (
    "id" VARCHAR(36) NOT NULL,
    "runId" VARCHAR(36) NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" VARCHAR(48) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dag_nodes" (
    "id" VARCHAR(36) NOT NULL,
    "runId" VARCHAR(36) NOT NULL,
    "nodeKey" VARCHAR(48) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "leaseOwner" VARCHAR(64),
    "leaseExpiresAt" TIMESTAMPTZ,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMPTZ,
    "finishedAt" TIMESTAMPTZ,

    CONSTRAINT "dag_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dag_edges" (
    "id" VARCHAR(36) NOT NULL,
    "runId" VARCHAR(36) NOT NULL,
    "fromNodeId" VARCHAR(36) NOT NULL,
    "toNodeId" VARCHAR(36) NOT NULL,

    CONSTRAINT "dag_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarifications" (
    "id" VARCHAR(36) NOT NULL,
    "runId" VARCHAR(36) NOT NULL,
    "claimId" VARCHAR(36),
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_ownerHash_createdAt_idx" ON "runs"("ownerHash", "createdAt");

-- CreateIndex
CREATE INDEX "runs_expiresAt_idx" ON "runs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "runs_ownerHash_idempotencyKey_key" ON "runs"("ownerHash", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "preparations_inputHash_key" ON "preparations"("inputHash");

-- CreateIndex
CREATE INDEX "claims_runId_idx" ON "claims"("runId");

-- CreateIndex
CREATE INDEX "source_documents_runId_idx" ON "source_documents"("runId");

-- CreateIndex
CREATE INDEX "evidence_units_sourceDocId_idx" ON "evidence_units"("sourceDocId");

-- CreateIndex
CREATE UNIQUE INDEX "claim_evidence_assessments_claimId_evidenceUnitId_key" ON "claim_evidence_assessments"("claimId", "evidenceUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_claimId_key" ON "decision_records"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "run_events_runId_seq_key" ON "run_events"("runId", "seq");

-- CreateIndex
CREATE INDEX "dag_nodes_status_leaseExpiresAt_idx" ON "dag_nodes"("status", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "dag_nodes_runId_nodeKey_key" ON "dag_nodes"("runId", "nodeKey");

-- CreateIndex
CREATE UNIQUE INDEX "dag_edges_runId_fromNodeId_toNodeId_key" ON "dag_edges"("runId", "fromNodeId", "toNodeId");

-- CreateIndex
CREATE INDEX "clarifications_runId_idx" ON "clarifications"("runId");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_prepId_fkey" FOREIGN KEY ("prepId") REFERENCES "preparations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_units" ADD CONSTRAINT "evidence_units_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_assessments" ADD CONSTRAINT "claim_evidence_assessments_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_assessments" ADD CONSTRAINT "claim_evidence_assessments_evidenceUnitId_fkey" FOREIGN KEY ("evidenceUnitId") REFERENCES "evidence_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dag_nodes" ADD CONSTRAINT "dag_nodes_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dag_edges" ADD CONSTRAINT "dag_edges_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dag_edges" ADD CONSTRAINT "dag_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "dag_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dag_edges" ADD CONSTRAINT "dag_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "dag_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
