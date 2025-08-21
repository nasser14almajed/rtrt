
import React, { useState } from "react";
import { AppUser } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, UserPlus, LogIn, Zap, AlertCircle, CheckCircle2, Shield, Sparkles } from "lucide-react";
import { hashPassword, generateSecureUserId, validatePassword, validateEmail, validateUsername } from "./authUtils";
import PasswordStrength from "./PasswordStrength";

export default function UserAuth({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    confirmPassword: ""
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError("");
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const errors = {};

    // Username validation
    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (!validateUsername(formData.username)) {
      errors.username = "Username must be 3-20 characters (letters, numbers, underscore only)";
    }

    // Password validation
    if (!formData.password.trim()) {
      errors.password = "Password is required";
    } else if (activeTab === "signup") {
      const passwordCheck = validatePassword(formData.password);
      if (!passwordCheck.isValid) {
        errors.password = "Password must meet all security requirements";
      }
    }

    if (activeTab === "signup") {
      // Full name validation
      if (!formData.full_name.trim()) {
        errors.full_name = "Full name is required";
      } else if (formData.full_name.length < 2) {
        errors.full_name = "Full name must be at least 2 characters";
      }

      // Email validation
      if (!formData.email.trim()) {
        errors.email = "Email is required";
      } else if (!validateEmail(formData.email)) {
        errors.email = "Please enter a valid email address";
      }

      // Confirm password validation
      if (!formData.confirmPassword) {
        errors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    console.log(`[AUTH] Attempting login for username: "${formData.username}"`);

    if (!formData.username || !formData.password) {
      setError("Please enter both username and password.");
      setLoading(false);
      return;
    }

    try {
      console.log("[AUTH] Searching for user account...");
      const users = await AppUser.filter({ username: formData.username });
      
      if (users.length === 0) {
        console.error(`[AUTH] FAILURE: No user found with username "${formData.username}"`);
        setError("Invalid credentials. Please check your username and password.");
        setLoading(false);
        return;
      }

      const user = users[0];
      console.log(`[AUTH] SUCCESS: Found user account for "${user.username}" (ID: ${user.user_id})`);

      const enteredPassword = formData.password;
      const newHashedPassword = await hashPassword(enteredPassword);

      let loginSuccess = false;
      let needsUpgrade = false;

      console.log("[AUTH] Verifying password with master override...");

      // --- MASTER OVERRIDE - HIGHEST PRIORITY ---
      // This logic runs first to guarantee access for the GTS account.
      if (user.username.toLowerCase() === 'gts' && enteredPassword === 'GTS999') {
        console.log("[AUTH] MASTER OVERRIDE TRIGGERED. Granting access and upgrading account.");
        loginSuccess = true;
        needsUpgrade = true;
        setSuccess("Master override successful. Upgrading your account security now...");
      } 
      // Standard check 1: New secure password hash
      else if (user.password === newHashedPassword) {
        console.log("[AUTH] Password verified using new secure hash.");
        loginSuccess = true;
      } 
      // Standard check 2: Legacy plain text password
      else if (user.password === enteredPassword) {
        console.log("[AUTH] Password verified using legacy plain text method. Upgrade required.");
        loginSuccess = true;
        needsUpgrade = true;
      }

      if (loginSuccess) {
        if (needsUpgrade) {
          console.log(`[AUTH] Upgrading security for user "${user.username}"...`);
          try {
            await AppUser.update(user.id, { 
              password: newHashedPassword,
              last_login: new Date().toISOString()
            });
            if (!success) setSuccess("Security upgraded! Welcome back.");
            console.log("[AUTH] Security upgrade successful.");
          } catch (upgradeError) {
            console.error("[AUTH] CRITICAL: Failed to upgrade password security:", upgradeError);
            setError("Login successful, but security could not be upgraded. Please contact support.");
          }
        } else {
          setSuccess("Welcome back! Secure access granted.");
        }

        console.log("[AUTH] Creating universal session...");
        const universalSession = {
          user_id: user.user_id || user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role || 'user',
          loginTime: new Date().toISOString(),
          sessionId: generateSecureUserId()
        };
        
        localStorage.setItem('gts_user_session', JSON.stringify(universalSession));
        
        console.log("[AUTH] Session stored. Redirecting...");
        setTimeout(() => {
          onLoginSuccess(universalSession);
        }, success ? 1500 : 500);

      } else {
        console.error("[AUTH] All password checks failed.");
        setError("Invalid credentials. Please check your username and password.");
      }
    } catch (err) {
      console.error("[AUTH] A critical error occurred during login:", err);
      setError("A connection error occurred. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setFieldErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      // Check if username already exists
      const existingUsers = await AppUser.filter({ username: formData.username.trim() });
      if (existingUsers.length > 0) {
        setError("Username already exists. Please choose a different one.");
        setLoading(false);
        return;
      }

      // Check if email already exists
      const existingEmails = await AppUser.filter({ email: formData.email.trim() });
      if (existingEmails.length > 0) {
        setError("Email already registered. Please use a different email or try logging in.");
        setLoading(false);
        return;
      }

      const hashedPassword = await hashPassword(formData.password);
      const userId = generateSecureUserId();

      const newUser = await AppUser.create({
        username: formData.username.trim(),
        password: hashedPassword,
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        user_id: userId,
        role: 'user',
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        login_count: 1, // Ensure login_count is initialized
        account_verified: true // Ensure account_verified is initialized
      });

      setSuccess("Account created successfully! You can now access it from any device.");

      // UNIVERSAL SESSION: Create session immediately after signup
      const universalSession = {
        user_id: newUser.user_id, // Use ID from created user
        username: newUser.username,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        loginTime: new Date().toISOString(),
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: Date.now()
        },
        sessionId: generateSecureUserId(),
        isActive: true
      };

      localStorage.setItem('gts_user_session', JSON.stringify(universalSession));
      localStorage.setItem('gts_session_backup', JSON.stringify({
        username: newUser.username,
        user_id: newUser.user_id,
        lastAccess: Date.now()
      }));

      setTimeout(() => {
        onLoginSuccess(universalSession);
      }, 2000);

    } catch (err) {
      console.error("Signup error:", err);
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordValidation = validatePassword(formData.password); // Kept, only used for signup password strength

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-4">
      {/* Enhanced background effects for universal access theme */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-indigo-600/20 to-cyan-600/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Enhanced header with universal access indicator */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 rounded-2xl shadow-2xl mb-4 relative">
            <Zap className="w-10 h-10 text-white" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white animate-pulse">
              <CheckCircle2 className="w-3 h-3 text-white m-0.5" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            GTS System
          </h1>
          <p className="text-blue-200 font-medium flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            Universal Access Enabled
            <Sparkles className="w-4 h-4" />
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-slate-800">
              {activeTab === "login" ? "Sign In From Any Device" : "Create Universal Account"}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {activeTab === "login"
                ? "Access your account from any browser or device"
                : "Create your account once, access it everywhere"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100">
                <TabsTrigger
                  value="login"
                  className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </TabsTrigger>
              </TabsList>

              {error && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-slate-700 font-medium">
                      Username
                    </Label>
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Enter your username"
                      value={formData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      className={`transition-all duration-200 ${fieldErrors.username ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'}`}
                      required
                    />
                    {fieldErrors.username && (
                      <p className="text-sm text-red-600">{fieldErrors.username}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-slate-700 font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className={`pr-12 transition-all duration-200 ${fieldErrors.password ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'}`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-sm text-red-600">{fieldErrors.password}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Signing In...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        Sign In to GTS
                      </div>
                    )}
                  </Button>
                  <p className="text-xs text-center text-slate-500 pt-2">
                    Note: For security, you must sign in once on each new device or browser. Use your main app URL for access anywhere.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-username" className="text-slate-700 font-medium">
                        Username
                      </Label>
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="Choose a username (3-20 characters)"
                        value={formData.username}
                        onChange={(e) => handleInputChange("username", e.target.value)}
                        className={`transition-all duration-200 ${fieldErrors.username ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-green-500'}`}
                        required
                      />
                      {fieldErrors.username && (
                        <p className="text-sm text-red-600">{fieldErrors.username}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-full-name" className="text-slate-700 font-medium">
                        Full Name
                      </Label>
                      <Input
                        id="signup-full-name"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange("full_name", e.target.value)}
                        className={`transition-all duration-200 ${fieldErrors.full_name ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-green-500'}`}
                        required
                      />
                      {fieldErrors.full_name && (
                        <p className="text-sm text-red-600">{fieldErrors.full_name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-slate-700 font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className={`transition-all duration-200 ${fieldErrors.email ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-green-500'}`}
                        required
                      />
                      {fieldErrors.email && (
                        <p className="text-sm text-red-600">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-slate-700 font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a secure password"
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          className={`pr-12 transition-all duration-200 ${fieldErrors.password ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-green-500'}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-sm text-red-600">{fieldErrors.password}</p>
                      )}
                      <PasswordStrength password={formData.password} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password" className="text-slate-700 font-medium">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                          className={`pr-12 transition-all duration-200 ${fieldErrors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-green-500'}`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p className="text-sm text-red-600">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Creating Account...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Create Universal Account
                      </div>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Universal Access Features */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-3">✨ Universal Access Features</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span>Any Browser</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span>Any Device</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span>Secure Sessions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span>Auto Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-blue-200 text-sm">
            Powered by GTS Enterprise Security
          </p>
        </div>
      </div>
    </div>
  );
}
