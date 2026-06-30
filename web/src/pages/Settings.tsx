import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  Settings as SettingsIcon, 
  User, 
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Trash2,
  Download,
  Upload,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { EmailIntegrationSettings } from "@/components/settings/EmailIntegrationSettings"
import { SettingsModal } from "@/components/settings/SettingsModal"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { useReopenSettingsModal } from "@/hooks/useReopenSettingsModal"
import { api, ApiError } from "@/lib/api"
import { downloadReportExport } from "@/hooks/useReports"
import { rangeFromPreset } from "@/lib/reports"
import type { UserSettings } from "@/types"

const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  wrong_current_password: "Current password is incorrect.",
  weak_password: "Password must be at least 8 characters.",
  same_password: "New password must be different from current.",
  no_password: "Password change is not available for this account.",
}

const SETTINGS_TABS = ["profile", "notifications", "security", "appearance", "integrations"] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

function parseSettingsTab(tab: string | null): SettingsTab {
  if (tab && SETTINGS_TABS.includes(tab as SettingsTab)) return tab as SettingsTab
  return "profile"
}

export default function Settings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseSettingsTab(searchParams.get("tab"))
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [exportingData, setExportingData] = useState(false)

  const handleExportData = async () => {
    setExportingData(true)
    try {
      const range = rangeFromPreset('30d')
      await downloadReportExport(range, 'summary', 'csv')
      toast.success('Engagement summary downloaded.')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Export failed'
      toast.error(message)
    } finally {
      setExportingData(false)
    }
  }

  const openSettingsModal = useCallback(() => setSettingsModalOpen(true), [])

  useEffect(() => {
    setProfileName(user?.name ?? "")
  }, [user?.name])

  const handleProfileCancel = () => {
    setProfileName(user?.name ?? "")
  }

  const handleProfileSave = async () => {
    setProfileSaving(true)
    try {
      await api<UserSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ name: profileName.trim() || null }),
      })
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
      toast.success("Profile updated.")
    } catch {
      toast.error("Could not save profile.")
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }

    setPasswordSaving(true)
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password updated.")
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined
      toast.error(PASSWORD_ERROR_MESSAGES[code ?? ""] ?? "Could not update password.")
    } finally {
      setPasswordSaving(false)
    }
  }

  useReopenSettingsModal(openSettingsModal, Boolean(user))

  useEffect(() => {
    const shouldOpen =
      searchParams.get("openSettings") === "1" ||
      searchParams.get("configure") === "gmail" ||
      searchParams.get("configure") === "outlook"
    if (!shouldOpen) return

    const next = new URLSearchParams(searchParams)
    next.delete("openSettings")
    next.delete("configure")
    if (activeTab !== "integrations") next.set("tab", "integrations")
    setSearchParams(next, { replace: true })
    setSettingsModalOpen(true)
  }, [searchParams, setSearchParams, activeTab])

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams)
    if (tab === "profile") next.delete("tab")
    else next.set("tab", tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and system configuration</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Settings */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="settings-profile-name">Name</Label>
                <Input
                  id="settings-profile-name"
                  name="settings-profile-name"
                  type="text"
                  autoComplete="name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <Label htmlFor="settings-profile-email">Email Address</Label>
                <Input
                  id="settings-profile-email"
                  name="settings-profile-email"
                  type="email"
                  autoComplete="off"
                  value={user?.email ?? ""}
                  disabled
                  className="opacity-70"
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleProfileCancel}
                  disabled={profileSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                  onClick={() => void handleProfileSave()}
                  disabled={profileSaving}
                >
                  {profileSaving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          {/* Notification Settings */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Deal Updates</h4>
                    <p className="text-sm text-muted-foreground">Get notified when deals change stage</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">New Leads</h4>
                    <p className="text-sm text-muted-foreground">Alert when new leads are assigned</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Task Reminders</h4>
                    <p className="text-sm text-muted-foreground">Reminders for upcoming tasks</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">AI Insights</h4>
                    <p className="text-sm text-muted-foreground">Notifications for AI-generated insights</p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Weekly Reports</h4>
                    <p className="text-sm text-muted-foreground">Receive weekly performance summaries</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {/* Security Settings */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Security & Privacy
              </CardTitle>
              <CardDescription>
                Manage your account security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Change Password</h4>
                {user?.hasPassword ? (
                  <form
                    autoComplete="off"
                    className="space-y-3"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    <div>
                      <Label htmlFor="settings-current-password">Current Password</Label>
                      <PasswordInput
                        id="settings-current-password"
                        name="settings-current-password"
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={passwordSaving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="settings-new-password">New Password</Label>
                      <PasswordInput
                        id="settings-new-password"
                        name="settings-new-password"
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordSaving}
                      />
                    </div>
                    <div>
                      <Label htmlFor="settings-confirm-password">Confirm New Password</Label>
                      <PasswordInput
                        id="settings-confirm-password"
                        name="settings-confirm-password"
                        autoComplete="off"
                        readOnly
                        onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={passwordSaving}
                      />
                    </div>
                    <Button
                      type="button"
                      className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                      onClick={() => void handlePasswordChange()}
                      disabled={passwordSaving}
                    >
                      {passwordSaving ? "Updating…" : "Update Password"}
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You sign in with Google/Microsoft. Password change is not available for this account.
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Two-Factor Authentication</h4>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline">Enable 2FA</Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Session Management</h4>
                    <p className="text-sm text-muted-foreground">View and manage active sessions</p>
                  </div>
                  <Button variant="outline">Manage Sessions</Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">API Keys</h4>
                    <p className="text-sm text-muted-foreground">Manage API access keys</p>
                  </div>
                  <Button variant="outline">
                    <Key className="h-4 w-4 mr-2" />
                    Manage Keys
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          {/* Appearance Settings */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Appearance & Display
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Theme</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                      <div className="h-16 bg-gradient-to-br from-background to-muted rounded mb-2"></div>
                      <p className="text-sm text-center">Light</p>
                    </div>
                    <div className="p-3 rounded-lg border-2 border-primary cursor-pointer bg-primary/5">
                      <div className="h-16 bg-gradient-to-br from-gray-900 to-gray-700 rounded mb-2"></div>
                      <p className="text-sm text-center">Dark</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                      <div className="h-16 bg-gradient-to-br from-background via-muted to-background rounded mb-2"></div>
                      <p className="text-sm text-center">System</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Compact Mode</h4>
                    <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Sidebar Collapsed</h4>
                    <p className="text-sm text-muted-foreground">Start with sidebar collapsed</p>
                  </div>
                  <Switch />
                </div>
                
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Input id="language" placeholder="English (US)" />
                </div>
                
                <div>
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Input id="dateFormat" placeholder="MM/DD/YYYY" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          {activeTab === "integrations" && (
            <EmailIntegrationSettings onOpenSettingsModal={openSettingsModal} />
          )}

          {/* Data Management */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data Management
              </CardTitle>
              <CardDescription>
                Import, export, and manage your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">Import Data</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center gap-2"
                  disabled={exportingData}
                  onClick={handleExportData}
                >
                  <Download className="h-5 w-5" />
                  <span className="text-sm">Export Data</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col items-center gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-5 w-5" />
                  <span className="text-sm">Delete Account</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {user?.mailProvider && (
        <SettingsModal
          open={settingsModalOpen}
          provider={user.mailProvider}
          onClose={() => setSettingsModalOpen(false)}
          onWiped={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
          onContactsChanged={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
        />
      )}
    </div>
  )
}