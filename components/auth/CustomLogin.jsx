import React, { useState } from "react";
import { AdminUser } from "@/api/entities/AdminUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, LogIn, Loader2, AlertCircle } from "lucide-react";

export default function CustomLogin({ onLoginSuccess }) {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [signupData, setSignupData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    fullName: ""
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setIsLoggingIn(true);
    setError("");

    try {
      // Find user with matching credentials
      const users = await AdminUser.filter({
        username: credentials.username,
        password: credentials.password,
        is_active: true
      });

      if (users.length > 0) {
        const user = users[0];
        // Store user session in localStorage
        localStorage.setItem('gts_admin_session', JSON.stringify({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          loginTime: new Date().toISOString()
        }));
        
        onLoginSuccess(user);
      } else {
        setError("Invalid username or password. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Login failed. Please try again.");
    }

    setIsLoggingIn(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!signupData.username.trim() || !signupData.password.trim() || !signupData.fullName.trim()) {
      setError("All fields are required.");
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (signupData.password.length < 4) {
      setError("Password must be at least 4 characters long.");
      return;
    }

    setIsLoggingIn(true);
    setError("");

    try {
      // Check if username already exists
      const existingUsers = await AdminUser.filter({
        username: signupData.username
      });

      if (existingUsers.length > 0) {
        setError("Username already exists. Please choose a different one.");
        setIsLoggingIn(false);
        return;
      }

      // Create new user
      const newUser = await AdminUser.create({
        username: signupData.username,
        password: signupData.password,
        full_name: signupData.fullName,
        role: "admin",
        is_active: true
      });

      // Auto login the new user
      localStorage.setItem('gts_admin_session', JSON.stringify({
        id: newUser.id,
        username: newUser.username,
        full_name: newUser.full_name,
        role: newUser.role,
        loginTime: new Date().toISOString()
      }));

      onLoginSuccess(newUser);
    } catch (error) {
      console.error("Signup error:", error);
      setError("Signup failed. Please try again.");
    }

    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">GTS Quiz Builder</CardTitle>
          <p className="text-slate-600">
            {showSignup ? "Create Admin Account" : "Admin Login Required"}
          </p>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!showSignup ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your username"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                  className="mt-1"
                />
              </div>

              <Button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>

              <div className="text-center mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSignup(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Don't have an account? Sign up
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={signupData.fullName}
                  onChange={(e) => setSignupData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="signupUsername">Username</Label>
                <Input
                  id="signupUsername"
                  type="text"
                  value={signupData.username}
                  onChange={(e) => setSignupData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Choose a unique username"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="signupPassword">Password</Label>
                <Input
                  id="signupPassword"
                  type="password"
                  value={signupData.password}
                  onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Choose a password"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                  className="mt-1"
                />
              </div>

              <Button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <div className="text-center mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSignup(false)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Already have an account? Sign in
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}