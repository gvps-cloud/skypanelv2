/**
 * OS Grouping Utility
 *
 * Groups provider images by OS distribution for consistent display
 * across VPS creation and rebuild dialogs.
 */

export interface OSGroup {
  key: string;
  name: string;
  versions: Array<{ id: string; label: string }>;
}

export interface ProviderImage {
  id: string;
  label: string;
  is_public?: boolean;
  deprecated?: boolean;
  vendor?: string;
}

/**
 * Groups provider images by OS distribution.
 *
 * Features:
 * - Groups images by distribution (Ubuntu, Debian, CentOS, etc.)
 * - Excludes non-OS entries like Kubernetes/LKE
 * - Sorts versions numerically (latest first)
 *
 * @param images - Array of provider images to group
 * @returns Record of OS groups keyed by distribution key
 */
export function groupImagesByOS(images: Array<ProviderImage>): Record<string, OSGroup> {
  const groups: Record<string, OSGroup> = {};

  const add = (key: string, name: string, id: string, label: string) => {
    if (!groups[key]) {
      groups[key] = { key, name, versions: [] };
    }
    groups[key].versions.push({ id, label });
  };

  (images || []).forEach((img: ProviderImage) => {
    const id: string = img.id || "";
    const label: string = img.label || id;
    const lower = `${id} ${label}`.toLowerCase();

    // Exclude non-OS entries like Kubernetes/LKE from OS selection
    if (/(^|\s)(kubernetes|lke|k8s)(\s|$)/i.test(lower)) {
      return;
    }

    // Group by distribution
    if (lower.includes("ubuntu")) {
      add("ubuntu", "Ubuntu", id, label);
    } else if (lower.includes("centos")) {
      add("centos", "CentOS", id, label);
    } else if (lower.includes("alma")) {
      add("almalinux", "AlmaLinux", id, label);
    } else if (lower.includes("rocky")) {
      add("rockylinux", "Rocky Linux", id, label);
    } else if (lower.includes("debian")) {
      add("debian", "Debian", id, label);
    } else if (lower.includes("fedora")) {
      add("fedora", "Fedora", id, label);
    } else if (lower.includes("alpine")) {
      add("alpine", "Alpine", id, label);
    } else if (lower.includes("arch")) {
      add("arch", "Arch Linux", id, label);
    } else if (lower.includes("opensuse")) {
      add("opensuse", "openSUSE", id, label);
    } else if (lower.includes("gentoo")) {
      add("gentoo", "Gentoo", id, label);
    } else if (lower.includes("slackware")) {
      add("slackware", "Slackware", id, label);
    }
  });

  // Sort versions descending by numeric parts in label to prefer latest first
  Object.values(groups).forEach((g) => {
    g.versions.sort((a, b) =>
      b.label.localeCompare(a.label, undefined, { numeric: true })
    );
  });

  return groups;
}

/**
 * Ordered list of OS keys for display.
 * Used to maintain consistent ordering across the UI.
 */
export const OS_DISPLAY_ORDER = [
  'ubuntu',
  'debian',
  'centos',
  'rockylinux',
  'almalinux',
  'fedora',
  'alpine',
  'arch',
  'opensuse',
  'gentoo',
  'slackware',
] as const;

/**
 * OS logo URLs from simpleicons.org
 */
export const OS_LOGO_MAP: Record<string, string> = {
  ubuntu: 'https://cdn.simpleicons.org/ubuntu/E95420',
  debian: 'https://cdn.simpleicons.org/debian/A81D33',
  centos: 'https://cdn.simpleicons.org/centos/262577',
  rockylinux: 'https://cdn.simpleicons.org/rockylinux/10B981',
  almalinux: 'https://cdn.simpleicons.org/almalinux/3D5AFE',
  fedora: 'https://cdn.simpleicons.org/fedora/51A2DA',
  alpine: 'https://cdn.simpleicons.org/alpinelinux/0D597F',
  arch: 'https://cdn.simpleicons.org/archlinux/1793D1',
  opensuse: 'https://cdn.simpleicons.org/opensuse/73BA25',
  gentoo: 'https://cdn.simpleicons.org/gentoo/54487A',
  slackware: 'https://cdn.simpleicons.org/slackware/000000',
};
