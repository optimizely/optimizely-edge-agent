/**
 * Edge Mode Final Test Suite - Using edge_mode_final_test flag
 * Tests content fetching, caching, and visitor stickiness
 */

module.exports = {
  id: 'edge-mode-final',
  name: 'Edge Mode Final Tests',
  description: 'Comprehensive Edge Mode testing with real content URLs',
  
  config: {
    baseUrl: 'http://localhost:8787',
    sdkKey: '8mR1pGh8u2ztUP8GqjmQq',
    flagKey: 'edge_mode_final_test',
    adminToken: 'dev-admin-token',
    githubPagesBase: 'https://simone-coelho.github.io/optimizely-edge-mode-demo',
    testVariations: {
      control: {
        key: 'control',
        expectedContent: 'Purple Theme',
        url: '/control.html'
      },
      a: {
        key: 'a', 
        expectedContent: 'Pink Theme',
        url: '/variation-a.html'
      },
      b: {
        key: 'b',
        expectedContent: 'Ocean Theme',
        url: '/variation-b.html'
      }
    }
  },

  tests: [
    {
      id: 'edge.final.setup',
      name: 'Edge Mode Setup Verification',
      description: 'Verify edge_mode_final_test flag exists in datafile',
      request: {
        method: 'GET',
        path: '/api/datafile',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}'
        }
      },
      validation: {
        status: 200,
        custom: async (response) => {
          const datafile = response.data;
          const flag = datafile.featureFlags?.find(f => f.key === 'edge_mode_final_test');
          
          if (!flag) {
            return {
              passed: false,
              message: 'Flag edge_mode_final_test not found in datafile'
            };
          }

          // Check for variations
          const hasVariations = flag.experimentIds && flag.experimentIds.length > 0;
          if (!hasVariations) {
            return {
              passed: false,
              message: 'Flag exists but has no experiment/variations configured'
            };
          }

          return {
            passed: true,
            message: `Flag configured with ${flag.experimentIds.length} experiment(s)`
          };
        }
      }
    },

    {
      id: 'edge.final.forced.control',
      name: 'Edge Mode - Force Control Variation',
      description: 'Test forcing control variation and content fetch',
      request: {
        method: 'GET',
        path: '/',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}',
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-Forced-Decisions': JSON.stringify({
            'edge_mode_final_test': { variationKey: 'control' }
          })
        }
      },
      validation: {
        status: 200,
        headers: {
          'x-optimizely-variation': 'control'
        },
        bodyContains: ['Purple Theme', 'Control Variation']
      }
    },

    {
      id: 'edge.final.forced.a',
      name: 'Edge Mode - Force Variation A',
      description: 'Test forcing variation A and content fetch',
      request: {
        method: 'GET',
        path: '/',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}',
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-Forced-Decisions': JSON.stringify({
            'edge_mode_final_test': { variationKey: 'a' }
          })
        }
      },
      validation: {
        status: 200,
        headers: {
          'x-optimizely-variation': 'a'
        },
        bodyContains: ['Pink Theme', 'Variation A']
      }
    },

    {
      id: 'edge.final.forced.b',
      name: 'Edge Mode - Force Variation B',
      description: 'Test forcing variation B and content fetch',
      request: {
        method: 'GET',
        path: '/',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}',
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-Forced-Decisions': JSON.stringify({
            'edge_mode_final_test': { variationKey: 'b' }
          })
        }
      },
      validation: {
        status: 200,
        headers: {
          'x-optimizely-variation': 'b'
        },
        bodyContains: ['Ocean Theme', 'Variation B']
      }
    },

    {
      id: 'edge.final.stickiness',
      name: 'Edge Mode - Visitor Stickiness',
      description: 'Test that same user gets same variation',
      sequence: [
        {
          name: 'First Request',
          request: {
            method: 'GET',
            path: '/',
            headers: {
              'X-Optimizely-SDK-Key': '{{sdkKey}}',
              'X-Optimizely-Enable-FEX': 'true'
            },
            query: {
              userId: 'sticky-test-user-123'
            }
          },
          capture: {
            variation: 'headers.x-optimizely-variation',
            cookies: 'headers.set-cookie'
          }
        },
        {
          name: 'Second Request - Same User',
          request: {
            method: 'GET',
            path: '/',
            headers: {
              'X-Optimizely-SDK-Key': '{{sdkKey}}',
              'X-Optimizely-Enable-FEX': 'true',
              'Cookie': '{{cookies}}'
            },
            query: {
              userId: 'sticky-test-user-123'
            }
          },
          validation: {
            headers: {
              'x-optimizely-variation': '{{variation}}'
            }
          }
        }
      ]
    },

    {
      id: 'edge.final.cache.performance',
      name: 'Edge Mode - Cache Performance',
      description: 'Test cache hit/miss headers and performance',
      sequence: [
        {
          name: 'Initial Request - Cache Miss',
          request: {
            method: 'GET',
            path: '/',
            headers: {
              'X-Optimizely-SDK-Key': '{{sdkKey}}',
              'X-Optimizely-Enable-FEX': 'true'
            },
            query: {
              userId: 'cache-test-user-456'
            }
          },
          validation: {
            headers: {
              'x-optimizely-cache': (value) => {
                return value === 'MISS' || value === undefined;
              }
            }
          },
          capture: {
            variation: 'headers.x-optimizely-variation'
          }
        },
        {
          name: 'Second Request - Cache Hit',
          request: {
            method: 'GET',
            path: '/',
            headers: {
              'X-Optimizely-SDK-Key': '{{sdkKey}}',
              'X-Optimizely-Enable-FEX': 'true'
            },
            query: {
              userId: 'cache-test-user-456'
            }
          },
          validation: {
            headers: {
              'x-optimizely-cache': 'HIT',
              'x-optimizely-variation': '{{variation}}'
            }
          }
        }
      ]
    },

    {
      id: 'edge.final.attributes',
      name: 'Edge Mode - Attribute-based Targeting',
      description: 'Test variation assignment with custom attributes',
      request: {
        method: 'GET',
        path: '/',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}',
          'X-Optimizely-Enable-FEX': 'true',
          'X-Optimizely-Attributes': JSON.stringify({
            country: 'US',
            plan_type: 'premium',
            ab_test_group: 'treatment'
          })
        },
        query: {
          userId: 'attribute-test-user-789'
        }
      },
      validation: {
        status: 200,
        headers: {
          'x-optimizely-variation': (value) => {
            return ['control', 'a', 'b'].includes(value);
          }
        }
      }
    },

    {
      id: 'edge.final.cookie.persistence',
      name: 'Edge Mode - Cookie Persistence',
      description: 'Test optimizely_visitor cookie setting and reading',
      sequence: [
        {
          name: 'Set Cookie',
          request: {
            method: 'GET',
            path: '/',
            headers: {
              'X-Optimizely-SDK-Key': '{{sdkKey}}',
              'X-Optimizely-Enable-FEX': 'true'
            },
            query: {
              userId: 'cookie-test-user-999'
            }
          },
          validation: {
            headers: {
              'set-cookie': (value) => {
                if (!value) return false;
                const cookieStr = Array.isArray(value) ? value.join('; ') : value;
                return cookieStr.includes('optimizely_visitor');
              }
            }
          },
          capture: {
            cookies: 'headers.set-cookie',
            variation: 'headers.x-optimizely-variation'
          }
        },
        {
          name: 'Read Cookie',
          request: {
            method: 'GET',
            path: '/',
            headers: {
              'X-Optimizely-SDK-Key': '{{sdkKey}}',
              'X-Optimizely-Enable-FEX': 'true',
              'Cookie': '{{cookies}}'
            }
          },
          validation: {
            headers: {
              'x-optimizely-variation': '{{variation}}'
            }
          }
        }
      ]
    },

    {
      id: 'edge.final.content.validation',
      name: 'Edge Mode - Content URL Validation',
      description: 'Verify correct GitHub Pages URLs are fetched',
      request: {
        method: 'GET',
        path: '/api/decide',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}',
          'X-Optimizely-Enable-FEX': 'true'
        },
        query: {
          flagKey: 'edge_mode_final_test',
          userId: 'content-validation-user'
        }
      },
      validation: {
        status: 200,
        custom: async (response) => {
          const decision = response.data;
          
          if (!decision.enabled) {
            return {
              passed: false,
              message: 'Flag not enabled for user'
            };
          }

          const cdnSettings = decision.variables?.cdnVariationSettings;
          if (!cdnSettings) {
            return {
              passed: false,
              message: 'No cdnVariationSettings in response'
            };
          }

          const contentUrl = cdnSettings.contentUrl;
          const expectedBase = 'https://simone-coelho.github.io/optimizely-edge-mode-demo';
          
          if (!contentUrl || !contentUrl.startsWith(expectedBase)) {
            return {
              passed: false,
              message: `Invalid content URL: ${contentUrl}`
            };
          }

          return {
            passed: true,
            message: `Valid content URL: ${contentUrl}`
          };
        }
      }
    },

    {
      id: 'edge.final.fallback',
      name: 'Edge Mode - Origin Fallback',
      description: 'Test fallback to origin when Edge Mode disabled',
      request: {
        method: 'GET',
        path: '/',
        headers: {
          'X-Optimizely-SDK-Key': '{{sdkKey}}',
          'X-Optimizely-Enable-FEX': 'false'  // Explicitly disable
        },
        query: {
          userId: 'fallback-test-user'
        }
      },
      validation: {
        status: 200,
        headers: {
          'x-optimizely-mode': (value) => {
            return value === 'passthrough' || value === undefined;
          }
        },
        bodyContains: (body) => {
          // Should NOT contain variation content
          return !body.includes('Purple Theme') && 
                 !body.includes('Pink Theme') && 
                 !body.includes('Ocean Theme');
        }
      }
    }
  ]
};