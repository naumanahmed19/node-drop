# Credential Sharing Feature

## Overview

The credential sharing feature allows users to securely share their credentials with other users in the system. This enables collaboration while maintaining security and access control.

## Features

- **Share credentials** with other users
- **Permission levels**: USE, VIEW, EDIT
- **Revoke access** at any time
- **Update permissions** for existing shares
- **View shared credentials** (credentials shared with you)
- **Track sharing history** (who shared, when, what permission)

## Database Schema

### CredentialShare Model

```prisma
model CredentialShare {
  id               String          @id @default(cuid())
  credentialId     String
  ownerUserId      String
  sharedWithUserId String
  permission       SharePermission @default(USE)
  sharedAt         DateTime        @default(now())
  sharedByUserId   String?
  
  credential       Credential      @relation(...)
  owner            User            @relation("CredentialOwner", ...)
  sharedWith       User            @relation("CredentialSharedWith", ...)
  sharedBy         User?           @relation("CredentialSharedBy", ...)
}

enum SharePermission {
  USE  // Can use in workflows
  VIEW // Can see credential details
  EDIT // Can modify credential
}
```

## API Endpoints

### Share Credential
```
POST /api/credentials/:id/share
Body: { userId: string, permission: 'USE' | 'VIEW' | 'EDIT' }
```

### Unshare Credential
```
DELETE /api/credentials/:id/share/:userId
```

### Get Credential Shares
```
GET /api/credentials/:id/shares
```

### Update Share Permission
```
PUT /api/credentials/:id/share/:userId
Body: { permission: 'USE' | 'VIEW' | 'EDIT' }
```

### Get Shared Credentials
```
GET /api/credentials/shared-with-me
```

### Search Users
```
GET /api/users/search?query=<search_term>
```

## Permission Levels

### USE
- Can use the credential in workflows
- Cannot view credential details
- Cannot modify the credential
- **Use case**: Share API keys for workflow execution without exposing the actual key

### VIEW
- Can view credential details
- Can use the credential in workflows
- Cannot modify the credential
- **Use case**: Share credentials for reference or debugging

### EDIT
- Full access to the credential
- Can view, use, and modify the credential
- Cannot delete the credential (only owner can)
- **Use case**: Collaborative credential management

## Security Considerations

1. **Encryption**: All credential data remains encrypted at rest
2. **Access Control**: Only credential owners can share/unshare
3. **Audit Trail**: All sharing actions are logged
4. **User Validation**: Target users must exist and be active
5. **Self-sharing Prevention**: Users cannot share credentials with themselves

## Usage Example

### Backend (Service)

```typescript
// Share a credential
await credentialService.shareCredential(
  credentialId,
  ownerUserId,
  targetUserId,
  'USE'
);

// Get all shares for a credential
const shares = await credentialService.getCredentialShares(
  credentialId,
  ownerUserId
);

// Revoke access
await credentialService.unshareCredential(
  credentialId,
  ownerUserId,
  targetUserId
);
```

### Frontend (Component)

```typescript
// Share credential
await credentialService.shareCredential(credentialId, userId, 'USE');

// Get shares
const shares = await credentialService.getCredentialShares(credentialId);

// Update permission
await credentialService.updateSharePermission(credentialId, userId, 'VIEW');

// Revoke access
await credentialService.unshareCredential(credentialId, userId);
```

## Future Enhancements

### TODO: Email Notifications
- Send email when credential is shared
- Send email when access is revoked
- Send email when permission is updated

### Potential Features
- Share with teams/groups
- Share via link with expiry
- Bulk sharing operations
- Share templates
- Activity feed for sharing events
- Advanced audit logging

## Testing

### Manual Testing Checklist
- [ ] Share credential with another user
- [ ] Verify shared user can access credential
- [ ] Update share permission
- [ ] Revoke access
- [ ] View shared credentials list
- [ ] Search for users
- [ ] Test permission levels (USE, VIEW, EDIT)
- [ ] Verify owner-only operations
- [ ] Test error cases (invalid user, duplicate share, etc.)

### Integration Testing
- [ ] Test with workflow execution
- [ ] Test with credential rotation
- [ ] Test with credential deletion (cascade)
- [ ] Test with user deletion (cascade)

## Migration

Run the migration to add credential sharing tables:

```bash
cd backend
npx prisma migrate dev --name add_credential_sharing
```

## Troubleshooting

### Common Issues

**Issue**: "Credential already shared with this user"
- **Solution**: Check existing shares before attempting to share

**Issue**: "Target user not found"
- **Solution**: Verify user exists and is active

**Issue**: "Credential not found or access denied"
- **Solution**: Verify user owns the credential or has appropriate permissions

## Support

For questions or issues, please refer to the main documentation or contact the development team.
