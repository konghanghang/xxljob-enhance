import { SetMetadata } from '@nestjs/common';

/**
 * Public route decorator
 * Mark routes that don't require JWT authentication
 * Usage: @Public()
 */
export const Public = () => SetMetadata('isPublic', true);
