import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { AdminClassesModule } from "../admin-classes/admin-classes.module";
import { MailModule } from "../mail/mail.module";
import { AdminInvitationsController } from "./admin-invitations.controller";
import { AdminInvitationsService } from "./admin-invitations.service";

@Module({
  imports: [AdminAuthModule, AdminClassesModule, MailModule],
  controllers: [AdminInvitationsController],
  providers: [AdminInvitationsService],
})
export class AdminInvitationsModule {}
