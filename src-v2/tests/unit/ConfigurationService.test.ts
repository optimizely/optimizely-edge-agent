describe('Response metadata configuration', () => {
  it('should enable response metadata when X-Optimizely-Enable-Response-Metadata is true', () => {
    const headers = {
      'x-optimizely-enable-response-metadata': 'true'
    };
    const configService = createConfigService({ headers });
    expect(configService.getEnableResponseMetadata()).toBe(true);
  });

  it('should enable response metadata when enableResponseMetadata query param is true', () => {
    const query = { enableResponseMetadata: 'true' };
    const configService = createConfigService({ query });
    expect(configService.getEnableResponseMetadata()).toBe(true);
  });

  it('should enable response metadata when body.enableResponseMetadata is true', () => {
    const body = { enableResponseMetadata: true };
    const configService = createConfigService({ body });
    expect(configService.getEnableResponseMetadata()).toBe(true);
  });

  it('should disable response metadata by default', () => {
    const configService = createConfigService({});
    expect(configService.getEnableResponseMetadata()).toBe(false);
  });
}); 