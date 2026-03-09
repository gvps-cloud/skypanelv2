# Bugfix Requirements Document

## Introduction

This document addresses a critical security vulnerability in the organization team settings that allows privilege escalation. Currently, any user with admin or higher permissions can modify member roles, including escalating their own role or another member's role to "owner". This violates the principle that only the current organization owner should be able to transfer ownership to another user.

The bug affects the organization member role update functionality accessible through the Team Settings interface at `/organizations/[org-id]` and the corresponding API endpoint `PUT /api/organizations/:id/members/:userId`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a non-owner user (e.g., admin) attempts to update any member's role to "owner" via the role update API THEN the system allows the role change without verifying the requester is the current owner

1.2 WHEN a non-owner user attempts to update their own role to "owner" THEN the system allows the self-escalation without ownership verification

1.3 WHEN a non-owner user with admin permissions accesses the Team Members interface THEN the system displays the "Update Role" option for all members including the ability to select "owner" role

1.4 WHEN the role update request includes a roleId corresponding to an "owner" role THEN the system processes the update without checking if the requester has owner privileges

### Expected Behavior (Correct)

2.1 WHEN a non-owner user attempts to update any member's role to "owner" THEN the system SHALL reject the request with a 403 Forbidden error indicating insufficient permissions

2.2 WHEN a non-owner user attempts to update their own role to "owner" THEN the system SHALL reject the request with a 403 Forbidden error preventing self-escalation

2.3 WHEN only the organization owner attempts to transfer ownership to another member THEN the system SHALL allow the role change and update the previous owner's role appropriately

2.4 WHEN the role update request includes a roleId corresponding to an "owner" role THEN the system SHALL verify the requester is the current owner before processing the update

2.5 WHEN a non-owner user accesses the Team Members interface THEN the system SHALL either hide the "owner" role option from the role selector or disable the update action for owner role selection

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an owner updates a non-owner member's role to admin or other non-owner roles THEN the system SHALL CONTINUE TO process the update successfully

3.2 WHEN an admin updates another member's role to a non-owner role (e.g., member to admin) THEN the system SHALL CONTINUE TO allow the update as per existing permissions

3.3 WHEN an owner attempts to demote themselves and they are the last owner THEN the system SHALL CONTINUE TO reject the request to prevent orphaned organizations

3.4 WHEN a member is removed from an organization THEN the system SHALL CONTINUE TO enforce the "cannot remove last owner" rule

3.5 WHEN role updates occur for non-owner roles THEN the system SHALL CONTINUE TO create activity feed entries for affected users

3.6 WHEN users with appropriate permissions access other team management features (invitations, custom roles) THEN the system SHALL CONTINUE TO function without changes
