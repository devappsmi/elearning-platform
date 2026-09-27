import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtStudentAuthGuard extends AuthGuard("jwt-student") {}
