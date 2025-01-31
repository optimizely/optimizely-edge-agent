import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizePathname, isAssetRequest, setLoggerFactory } from './index';
import Logger from './_helpers_/logger';

describe('Edge Worker Index', () => {
	let mockLogger;

	beforeEach(() => {
		// Create mock logger instance
		mockLogger = {
			info: vi.fn(),
			debug: vi.fn(),
			debugExt: vi.fn(),
			error: vi.fn(),
		};

		// Set up the logger factory to return our mock logger
		setLoggerFactory(() => mockLogger);
	});

	describe('normalizePathname', () => {
		it('should remove leading double slash', () => {
			expect(normalizePathname('//test/path')).toBe('/test/path');
		});

		it('should not modify path without double slash', () => {
			expect(normalizePathname('/test/path')).toBe('/test/path');
		});

		it('should handle empty path', () => {
			expect(normalizePathname('')).toBe('');
		});

		it('should handle paths with multiple slashes', () => {
			expect(normalizePathname('///test/path')).toBe('//test/path');
		});
	});

	describe('isAssetRequest', () => {
		beforeEach(() => {
			mockLogger.debug.mockClear();
		});

		it('should identify image asset requests', () => {
			expect(isAssetRequest('/assets/image.jpg')).toBe(true);
			expect(isAssetRequest('/images/photo.jpeg')).toBe(true);
			expect(isAssetRequest('/static/icon.png')).toBe(true);
			expect(isAssetRequest('/logo.gif')).toBe(true);
			expect(isAssetRequest('/icons/menu.svg')).toBe(true);
		});

		it('should identify web asset requests', () => {
			expect(isAssetRequest('/styles/main.css')).toBe(true);
			expect(isAssetRequest('/scripts/app.js')).toBe(true);
			expect(isAssetRequest('/favicon.ico')).toBe(true);
		});

		it('should identify font asset requests', () => {
			expect(isAssetRequest('/fonts/roboto.woff')).toBe(true);
			expect(isAssetRequest('/fonts/opensans.woff2')).toBe(true);
			expect(isAssetRequest('/fonts/lato.ttf')).toBe(true);
			expect(isAssetRequest('/fonts/arial.eot')).toBe(true);
		});

		it('should identify non-asset requests', () => {
			expect(isAssetRequest('/api/data')).toBe(false);
			expect(isAssetRequest('/optimizely')).toBe(false);
			expect(isAssetRequest('/')).toBe(false);
			expect(isAssetRequest('/users/profile')).toBe(false);
			expect(isAssetRequest('/assets/documents/report.pdf')).toBe(false);
		});

		it('should be case insensitive', () => {
			expect(isAssetRequest('/image.JPG')).toBe(true);
			expect(isAssetRequest('/style.CSS')).toBe(true);
			expect(isAssetRequest('/font.WOFF')).toBe(true);
		});

		it('should log debug messages', () => {
			isAssetRequest('/test.jpg');
			expect(mockLogger.debug).toHaveBeenCalledWith(
				'Edgeworker index.js - Checking if request is for an asset [isAssetRequest]',
				true,
			);

			isAssetRequest('/api/data');
			expect(mockLogger.debug).toHaveBeenCalledWith(
				'Edgeworker index.js - Checking if request is for an asset [isAssetRequest]',
				false,
			);
		});
	});
});
