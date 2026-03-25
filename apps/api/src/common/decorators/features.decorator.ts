import { SetMetadata } from '@nestjs/common';

export const FEATURES_KEY = 'features';

/**
 * 권한 체크에 사용할 feature.code 들을 지정합니다.
 * 예) @Features('EVENT_EDIT', 'TEMPLATE_EDIT')
 */
export const Features = (...featureCodes: string[]) =>
  SetMetadata(FEATURES_KEY, featureCodes);
