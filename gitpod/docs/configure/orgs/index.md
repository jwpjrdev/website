---
section: orgs
title: Organizations
---

<script context="module">
  export const prerender = true;
</script>

# Organizations

Organizations are used to share [Projects](/docs/configure/projects) amongst organization members.

There are two roles within a Gitpod organization **organization owners** and **organization members**. Organization members and owners can view branches and prebuilds for the projects within an organization. Organization members can open new workspaces directly from a branch in the dashboard. Organization owners can manage other organization members, reset user invite URLs, and manage [Organization billing](/docs/configure/billing/org-billing).

To collaborate with others on projects you can create a **Organization** and invite others as organization members.

### View organizations

To view all your organizations, click on the scope selector on the left of the top bar.

### Create an organization

To create a new organization:

1. On the top bar, click on the scope selector and select _New Organization_.
2. Next, you will be asked for an organization name that will serve also as the organization slug.

### Add members to an organization

Once you create an organization you can invite members by using the unique invite URL from the Members page within an organization.

### Change member permissions

New members will join with a _Member_ role which you can later change if needed from the Members list using the more actions button. See [Roles](#roles) below.

### Remove a member from an organization

You can remove an organization member form the Members list using the more actions button while hovering over the user entry.

### Filter members in an organization

On the Members page you can filter users by membership role using the filters above the Members list.

### Leaving an organization

You can leave an organization using the more actions button in the Members list while hovering over your user entry.

## Roles

| Permission                  | Owner | Member |
| --------------------------- | ----- | ------ |
| Manage Organization Members | Yes   | No     |
| Edit Organization Settings  | Yes   | No     |
| Manage Organization Billing | Yes   | No     |
| View Organization Usage     | Yes   | No     |
| Edit Project Settings       | Yes   | Yes    |
| Edit Project Variables      | Yes   | Yes    |
| Invite Organization Members | Yes   | Yes    |
| Add Projects                | Yes   | Yes    |
| Remove Projects             | Yes   | Yes    |
| View Branches               | Yes   | Yes    |
| View Prebuilds              | Yes   | Yes    |
| Trigger Prebuilds           | Yes   | Yes    |
