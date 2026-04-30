import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { useSidebar } from "@/components/ui/sidebar-context"

const NAV_GROUP_STORAGE_PREFIX = "nav-main-open-groups"

type NavGroupState = Record<string, boolean>

const loadStoredGroupState = (key: string): NavGroupState => {
  if (typeof window === "undefined") {
    return {}
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as NavGroupState
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const areGroupStatesEqual = (a: NavGroupState, b: NavGroupState) => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) {
    return false
  }

  return aKeys.every((key) => a[key] === b[key])
}

export function NavMain({
  items,
  label = "Platform",
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
      isActive?: boolean
      items?: {
        title: string
        url: string
        isActive?: boolean
      }[]
    }[]
  }[]
  label?: string
}) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const storageKey = React.useMemo(() => {
    const safeLabel = label?.toLowerCase().replace(/\s+/g, "-") ?? "default"
    return `${NAV_GROUP_STORAGE_PREFIX}:${safeLabel}`
  }, [label])

  const [openGroups, setOpenGroups] = React.useState<NavGroupState>(() =>
    loadStoredGroupState(storageKey)
  )

  React.useEffect(() => {
    const storedState = loadStoredGroupState(storageKey)
    setOpenGroups((prev) => (areGroupStatesEqual(prev, storedState) ? prev : storedState))
  }, [storageKey])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(storageKey, JSON.stringify(openGroups))
  }, [openGroups, storageKey])

  const handleGroupToggle = React.useCallback(
    (key: string, nextOpen: boolean) => {
      setOpenGroups((prev) => {
        if (prev[key] === nextOpen) {
          return prev
        }

        return { ...prev, [key]: nextOpen }
      })
    },
    [setOpenGroups]
  )

  React.useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false
      const next: NavGroupState = { ...prev }

      items.forEach((item) => {
        const itemKey = item.url || item.title
        const isItemActive = item.isActive || item.items?.some((sub) => sub.isActive)
        if (isItemActive && !next[itemKey]) {
          next[itemKey] = true
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [items])

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasActiveChild = item.items?.some((sub) => sub.isActive || sub.items?.some((nested) => nested.isActive)) ?? false
          const isExactActive = Boolean(item.isActive)
          const isItemActive = isExactActive || hasActiveChild
          const itemKey = item.url || item.title
          const persistedState = openGroups[itemKey]
          const openValue = isItemActive ? true : persistedState ?? false

          return (
            <SidebarMenuItem key={item.title}>
              {item.items?.length ? (
                isCollapsed ? (
                  // Collapsed state: Show popover with sub-items
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isExactActive}
                        className={cn(hasActiveChild && !isExactActive ? "bg-sidebar-accent/50 text-sidebar-accent-foreground" : "")}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="w-48 p-2">
                      <div className="space-y-1">
                        <div className="px-2 py-1.5 text-sm font-medium text-foreground">
                          {item.title}
                        </div>
                        {item.items?.map((subItem) => (
                          <div key={subItem.title}>
                            {subItem.items?.length ? (
                              <div className="space-y-1">
                                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                                  {subItem.title}
                                </div>
                                {subItem.items?.map((nestedItem) => (
                                  <Link
                                    key={nestedItem.title}
                                    to={nestedItem.url}
                                    className={cn(
                                      "flex items-center rounded-md px-4 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                                      nestedItem.isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
                                    )}
                                  >
                                    {nestedItem.title}
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <Link
                                to={subItem.url}
                                className={cn(
                                  "flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                                  subItem.isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
                                )}
                              >
                                {subItem.title}
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  // Expanded state: Show normal collapsible
                  <Collapsible
                    asChild
                    open={openValue}
                    onOpenChange={(nextOpen) => handleGroupToggle(itemKey, nextOpen)}
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isExactActive}
                          className={cn(hasActiveChild && !isExactActive ? "bg-sidebar-accent/50 text-sidebar-accent-foreground" : "")}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="data-[state=open]:rotate-90">
                          <ChevronRight />
                          <span className="sr-only">Toggle</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              {subItem.items?.length ? (
                                <Collapsible asChild defaultOpen={subItem.isActive}>
                                  <>
                                    <CollapsibleTrigger asChild>
                                      <SidebarMenuSubButton isActive={subItem.isActive}>
                                        <span>{subItem.title}</span>
                                      </SidebarMenuSubButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <SidebarMenuSub>
                                        {subItem.items?.map((nestedItem) => (
                                          <SidebarMenuSubItem key={nestedItem.title}>
                                            <SidebarMenuSubButton asChild isActive={nestedItem.isActive}>
                                              <Link to={nestedItem.url}>
                                                <span>{nestedItem.title}</span>
                                              </Link>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        ))}
                                      </SidebarMenuSub>
                                    </CollapsibleContent>
                                  </>
                                </Collapsible>
                              ) : (
                                <SidebarMenuSubButton asChild isActive={subItem.isActive}>
                                  <Link to={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                )
              ) : (
                <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive}>
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
