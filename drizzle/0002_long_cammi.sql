CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("to_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("to_user_id") WHERE read_at is null;
