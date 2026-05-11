import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, RoleService, PREDEFINED_ROLES } from './roles.js';

describe('RoleService', () => {
  describe('PREDEFINED_ROLES', () => {
    it('should include the member role', () => {
      expect(PREDEFINED_ROLES).toHaveProperty('member');
    });

    it('should include the hosting_manager role', () => {
      expect(PREDEFINED_ROLES).toHaveProperty('hosting_manager');
    });

    it('should include the billing_manager role', () => {
      expect(PREDEFINED_ROLES).toHaveProperty('billing_manager');
      expect(PREDEFINED_ROLES.billing_manager).toContain('billing_view');
      expect(PREDEFINED_ROLES.billing_manager).toContain('billing_manage');
      expect(PREDEFINED_ROLES.billing_manager).toContain('egress_manage');
    });

    it('member should have hosting_manage permission', () => {
      expect(PREDEFINED_ROLES.member).toContain('hosting_manage');
    });

    it('hosting_manager should have hosting_view and hosting_manage', () => {
      expect(PREDEFINED_ROLES.hosting_manager).toContain('hosting_view');
      expect(PREDEFINED_ROLES.hosting_manager).toContain('hosting_manage');
    });

    it('hosting_manager should not have any vps_* permissions', () => {
      const vpsPerms = PREDEFINED_ROLES.hosting_manager.filter((p: string) => p.startsWith('vps_'));
      expect(vpsPerms).toHaveLength(0);
    });

    it('viewer should not have hosting_manage', () => {
      expect(PREDEFINED_ROLES.viewer).not.toContain('hosting_manage');
    });

    it('owner, admin, member, support_agent, viewer, and hosting_manager should include hosting_view', () => {
      ['owner', 'admin', 'member', 'support_agent', 'viewer', 'hosting_manager'].forEach((name) => {
        expect(PREDEFINED_ROLES[name]).toContain('hosting_view');
      });
    });

    it('owner and admin should include hosting_manage', () => {
      expect(PREDEFINED_ROLES.owner).toContain('hosting_manage');
      expect(PREDEFINED_ROLES.admin).toContain('hosting_manage');
    });

    it('vps_manager should not include hosting_view or hosting_manage', () => {
      expect(PREDEFINED_ROLES.vps_manager).not.toContain('hosting_view');
      expect(PREDEFINED_ROLES.vps_manager).not.toContain('hosting_manage');
    });

    it('support_agent should not include hosting_manage', () => {
      expect(PREDEFINED_ROLES.support_agent).not.toContain('hosting_manage');
    });

    it('owner and admin should have every permission', () => {
      expect([...PREDEFINED_ROLES.owner].sort()).toEqual([...ALL_PERMISSIONS].sort());
      expect([...PREDEFINED_ROLES.admin].sort()).toEqual([...ALL_PERMISSIONS].sort());
    });

    it('should validate and parse permissions centrally', () => {
      expect(RoleService.isValidPermission('hosting_manage')).toBe(true);
      expect(RoleService.isValidPermission('not_real')).toBe(false);
      expect(RoleService.parsePermissions('["billing_manage","not_real","hosting_view"]')).toEqual([
        'billing_manage',
        'hosting_view',
      ]);
    });

    it('should have exactly 8 predefined roles', () => {
      expect(Object.keys(PREDEFINED_ROLES)).toHaveLength(8);
    });

    it('should contain all expected roles', () => {
      expect(Object.keys(PREDEFINED_ROLES).sort()).toEqual([
        'admin',
        'billing_manager',
        'hosting_manager',
        'member',
        'owner',
        'support_agent',
        'viewer',
        'vps_manager',
      ]);
    });
  });
});
