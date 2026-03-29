// src/entities/basic_entities.ts

/**
 * 공통 타입
 * - BINARY(16): 애플리케이션에서 UUID(v7) 문자열로 다루고, DB에는 BINARY(16)으로 저장
 * - TINYINT(1): 0/1 플래그(드라이버에서 number로 오는 경우가 일반적)
 * - DECIMAL/BIGINT: 드라이버 설정에 따라 string으로 반환되는 경우가 많아서 number | string
 */
export type Uuid = string;
export type TinyIntBoolean = 0 | 1;
export type DecimalLike = number | string;
export type BigIntLike = number | string;

/**
 * DB Table: `role`
 */
export interface RoleModel {
  id: Uuid;

  code: string; // ADMIN, MANAGER, GENERAL 등
  name: string;

  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
}

/**
 * DB Table: `user`
 */
export interface UserModel {
  id: Uuid;

  role_id: Uuid;

  email: string;
  name: string;
  position: string | null;
  is_active: TinyIntBoolean;
  password_hash: string;

  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
}
