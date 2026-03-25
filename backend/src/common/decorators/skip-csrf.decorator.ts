import { SetMetadata } from '@nestjs/common';
import { SKIP_CSRF_KEY } from '../guards/csrf.guard';

/** Apply to controllers or handlers that should bypass CSRF validation. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
