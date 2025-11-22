import { CredentialService } from '../../services/CredentialService';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/errors';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = {
  credential: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as any;

// Mock environment variable
process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('CredentialService', () => {
  let credentialService: CredentialService;
  const mockUserId = 'user-123';
  const mockCredentialId = 'cred-123';

  beforeEach(() => {
    jest.clearAllMocks();
    credentialService = new CredentialService();
    // Replace the prisma instance with our mock
    (credentialService as any).prisma = mockPrisma;
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt credential data correctly', async () => {
      const testData = {
        username: 'testuser',
        password: 'testpass123',
        apiKey: 'secret-api-key'
      };

      mockPrisma.credential.findFirst.mockResolvedValue(null);
      mockPrisma.credential.create.mockResolvedValue({
        id: mockCredentialId,
        name: 'test-cred',
        type: 'httpBasicAuth',
        userId: mockUserId,
        data: 'encrypted-data',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const credential = await credentialService.createCredential(
        mockUserId,
        'test-cred',
        'httpBasicAuth',
        testData
      );

      expect(credential.data).toEqual(testData);
    });

    it('should fail with invalid encryption key', () => {
      const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'invalid-key';

      expect(() => {
        new CredentialService();
      }).toThrow('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string');

      process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    });
  });

  describe('Credential Creation', () => {
    it('should create a valid credential', async () => {
      const credentialData = {
        username: 'testuser',
        password: 'testpass123'
      };

      mockPrisma.credential.findFirst.mockResolvedValue(null);
      mockPrisma.credential.create.mockResolvedValue({
        id: mockCredentialId,
        name: 'test-cred',
        type: 'httpBasicAuth',
        userId: mockUserId,
        data: 'encrypted-data',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const credential = await credentialService.createCredential(
        mockUserId,
        'test-cred',
        'httpBasicAuth',
        credentialData
      );

      expect(credential.name).toBe('test-cred');
      expect(credential.type).toBe('httpBasicAuth');
      expect(credential.data).toEqual(credentialData);
    });

    it('should reject duplicate credential names', async () => {
      mockPrisma.credential.findFirst.mockResolvedValue({
        id: 'existing-cred',
        name: 'test-cred',
        userId: mockUserId
      });

      await expect(
        credentialService.createCredential(
          mockUserId,
          'test-cred',
          'httpBasicAuth',
          { username: 'test', password: 'test' }
        )
      ).rejects.toThrow('A credential with this name already exists');
    });

    it('should reject unknown credential types', async () => {
      await expect(
        credentialService.createCredential(
          mockUserId,
          'test-cred',
          'unknownType',
          { data: 'test' }
        )
      ).rejects.toThrow('Unknown credential type: unknownType');
    });

    it('should validate required fields', async () => {
      await expect(
        credentialService.createCredential(
          mockUserId,
          'test-cred',
          'httpBasicAuth',
          { username: 'test' } // Missing password
        )
      ).rejects.toThrow('Password is required');
    });
  });

  describe('Credential Retrieval', () => {
    it('should retrieve credential with decrypted data', async () => {
      // First create a credential to get properly encrypted data
      const testData = { username: 'test', password: 'test123' };
      
      // Create credential first to get encrypted data
      const encryptedData = (credentialService as any).encryptData(testData);

      // Now mock the retrieval with the encrypted data
      mockPrisma.credential.findFirst.mockResolvedValue({
        id: mockCredentialId,
        name: 'test-cred',
        type: 'httpBasicAuth',
        userId: mockUserId,
        data: encryptedData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const credential = await credentialService.getCredential(mockCredentialId, mockUserId);
      expect(credential).toBeTruthy();
      expect(credential!.id).toBe(mockCredentialId);
      expect(credential!.data).toEqual(testData);
    });

    it('should return null for non-existent credential', async () => {
      mockPrisma.credential.findFirst.mockResolvedValue(null);

      const credential = await credentialService.getCredential('non-existent', mockUserId);
      expect(credential).toBeNull();
    });

    it('should reject expired credentials', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      mockPrisma.credential.findFirst.mockResolvedValue({
        id: mockCredentialId,
        name: 'test-cred',
        type: 'httpBasicAuth',
        userId: mockUserId,
        data: 'encrypted-data',
        expiresAt: expiredDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await expect(
        credentialService.getCredential(mockCredentialId, mockUserId)
      ).rejects.toThrow('Credential has expired');
    });
  });

  describe('Credential Testing', () => {
    it('should test HTTP Basic Auth credentials', async () => {
      const result = await credentialService.testCredential('httpBasicAuth', {
        username: 'test',
        password: 'test123'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should test API Key credentials', async () => {
      const result = await credentialService.testCredential('apiKey', {
        apiKey: 'valid-api-key-123'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should reject invalid API Key', async () => {
      const result = await credentialService.testCredential('apiKey', {
        apiKey: 'short'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('too short');
    });

    it('should test OAuth2 credentials', async () => {
      const result = await credentialService.testCredential('oauth2', {
        clientId: 'client123',
        clientSecret: 'secret123'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('should reject unknown credential types', async () => {
      const result = await credentialService.testCredential('unknown', {
        data: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown credential type');
    });
  });

  describe('Credential Rotation', () => {
    it('should rotate credential successfully', async () => {
      const existingCredential = {
        id: mockCredentialId,
        name: 'test-cred',
        type: 'httpBasicAuth',
        userId: mockUserId,
        data: 'old-encrypted-data',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const newData = {
        username: 'newuser',
        password: 'newpass123'
      };

      mockPrisma.credential.findFirst.mockResolvedValue(existingCredential);
      mockPrisma.credential.update.mockResolvedValue({
        ...existingCredential,
        data: 'new-encrypted-data',
        updatedAt: new Date()
      });

      const rotatedCredential = await credentialService.rotateCredential(
        mockCredentialId,
        mockUserId,
        newData
      );

      expect(rotatedCredential.data).toEqual(newData);
      expect(mockPrisma.credential.update).toHaveBeenCalledWith({
        where: { id: mockCredentialId },
        data: expect.objectContaining({
          data: expect.any(String),
          expiresAt: expect.any(Date)
        })
      });
    });

    it('should reject rotation of non-existent credential', async () => {
      mockPrisma.credential.findFirst.mockResolvedValue(null);

      await expect(
        credentialService.rotateCredential(
          'non-existent',
          mockUserId,
          { username: 'test', password: 'test' }
        )
      ).rejects.toThrow('Credential not found');
    });
  });

  describe('Expiring Credentials', () => {
    it('should find expiring credentials', async () => {
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + 3); // 3 days from now

      const expiringCredentials = [
        {
          id: 'cred-1',
          name: 'expiring-cred',
          type: 'apiKey',
          expiresAt: expiringDate
        }
      ];

      mockPrisma.credential.findMany.mockResolvedValue(expiringCredentials);

      const result = await credentialService.getExpiringCredentials(mockUserId, 7);
      expect(result).toEqual(expiringCredentials);
      expect(mockPrisma.credential.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          expiresAt: {
            lte: expect.any(Date),
            gt: expect.any(Date)
          }
        },
        select: {
          id: true,
          name: true,
          type: true,
          expiresAt: true
        }
      });
    });
  });

  describe('Security Validation', () => {
    it('should validate credential data types', async () => {
      await expect(
        credentialService.createCredential(
          mockUserId,
          'test-cred',
          'httpBasicAuth',
          { username: 123, password: 'test' } // Invalid type
        )
      ).rejects.toThrow('Username must be a string');
    });

    it('should sanitize credential data', () => {
      const service = credentialService as any;
      const dangerousData = {
        username: 'test',
        password: 'test123',
        __proto__: { malicious: true },
        constructor: { evil: true }
      };

      const sanitized = service.deepSanitize(dangerousData);
      
      // Check that dangerous properties are not in the enumerable properties
      const keys = Object.keys(sanitized);
      expect(keys).not.toContain('__proto__');
      expect(keys).not.toContain('constructor');
      expect(keys).not.toContain('prototype');
      
      // Check that safe properties are preserved
      expect(sanitized.username).toBe('test');
      expect(sanitized.password).toBe('test123');
    });

    it('should prevent credential access across users', async () => {
      mockPrisma.credential.findFirst.mockResolvedValue(null);

      const credential = await credentialService.getCredential(
        mockCredentialId,
        'different-user-id'
      );

      expect(credential).toBeNull();
      expect(mockPrisma.credential.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockCredentialId,
          userId: 'different-user-id'
        }
      });
    });
  });

  describe('Credential Types', () => {
    it('should return available credential types', () => {
      const types = credentialService.getCredentialTypes();
      
      expect(types).toHaveLength(3);
      expect(types.map(t => t.name)).toContain('httpBasicAuth');
      expect(types.map(t => t.name)).toContain('apiKey');
      expect(types.map(t => t.name)).toContain('oauth2');
    });

    it('should get specific credential type', () => {
      const httpBasicAuth = credentialService.getCredentialType('httpBasicAuth');
      
      expect(httpBasicAuth).toBeTruthy();
      expect(httpBasicAuth!.displayName).toBe('HTTP Basic Auth');
      expect(httpBasicAuth!.properties).toHaveLength(2);
    });

    it('should return null for unknown credential type', () => {
      const unknown = credentialService.getCredentialType('unknown');
      expect(unknown).toBeNull();
    });
  });
});
