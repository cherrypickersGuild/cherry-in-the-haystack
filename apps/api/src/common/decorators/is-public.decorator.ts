import { SetMetadata } from '@nestjs/common';

/**
 * 메타데이터 키
 * @constant {string}
 * @description 데코레이터가 적용된 엔드포인트가 공개(public)임을 나타내는 메타데이터 키입니다.
 */
export const IS_PUBLIC_KEY = 'is_public';

/**
 * IsPublic 데코레이터
 * @function IsPublic
 * @description 해당 데코레이터를 적용한 엔드포인트가 인증 없이 접근 가능한 공개 엔드포인트임을 나타내는 메타데이터를 설정합니다.
 * @returns 데코레이터 함수
 */
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);
