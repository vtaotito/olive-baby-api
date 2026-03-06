-- CreateTable
CREATE TABLE "email_communications" (
    "id" SERIAL NOT NULL,
    "template_type" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "recipient_domain" VARCHAR(100),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "email_communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_communications_template_type_idx" ON "email_communications"("template_type");

-- CreateIndex
CREATE INDEX "email_communications_channel_idx" ON "email_communications"("channel");

-- CreateIndex
CREATE INDEX "email_communications_sent_at_idx" ON "email_communications"("sent_at");

-- CreateIndex
CREATE INDEX "email_communications_template_type_sent_at_idx" ON "email_communications"("template_type", "sent_at");
