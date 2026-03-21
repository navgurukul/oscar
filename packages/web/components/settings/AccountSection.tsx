"use client";

import { useState } from "react";
import { User, Mail, Key, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AccountSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete-account", { method: "DELETE" });
      if (!response.ok) throw new Error("Deletion failed");

      toast({
        title: "Account deleted",
        description: "Your account and all data have been permanently deleted.",
      });
    } catch {
      toast({
        title: "Failed to delete account",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-500" />
            Profile Information
          </CardTitle>
          <CardDescription className="text-gray-400">
            View and manage your account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300">Email Address</Label>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-500" />
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-slate-800 border-slate-700 text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userId" className="text-gray-300">User ID</Label>
            <Input
              id="userId"
              value={user?.id || ""}
              disabled
              className="bg-slate-800 border-slate-700 text-gray-500 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="bg-slate-900 border-cyan-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-500" />
            Password
          </CardTitle>
          <CardDescription className="text-gray-400">
            Manage your password and security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm mb-4">
            You signed in with Google. Password management is handled through your Google account.
          </p>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="bg-slate-900 border-red-700/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Delete Account
          </CardTitle>
          <CardDescription className="text-gray-400">
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400">
                  This action cannot be undone. This will permanently delete your account
                  and remove all your data from our servers, including:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-gray-300">
                    <li>All your notes and transcriptions</li>
                    <li>Your vocabulary entries</li>
                    <li>Your subscription information</li>
                    <li>Account settings and preferences</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? "Deleting..." : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
