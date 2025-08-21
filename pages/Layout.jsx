

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import UserAuth from "@/components/auth/UserAuth";
import {
  Layout as LayoutIcon,
  Plus,
  BarChart3,
  Database,
  Zap,
  LogOut,
  Globe,
  User as UserIcon,
  FileText,
  CheckCircle2,
  History // Added History icon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LanguageContext = React.createContext();

const translations = {
  en: {
    appTitle: "GTS Quiz Builder",
    appSubtitle: "Personal Quiz Management",
    navigation: "Navigation",
    dashboard: "Dashboard",
    dashboardDesc: "Manage all quizzes",
    quizBuilder: "Quiz Builder",
    quizBuilderDesc: "Create new quiz",
    submissions: "Submissions",
    submissionsDesc: "View responses",
    questionBank: "Question Bank",
    questionBankDesc: "Reusable questions",
    status: "Status",
    systemStatus: "System Status",
    operational: "✅ Operational",
    autoSave: "Auto-Save",
    active: "🔄 Active",
    logOut: "Log Out",
    switchLanguage: "Switch to Arabic",
    customDatabase: "GTS Virtual Database",
    unlimitedStorage: "UNLIMITED STORAGE",
    personalCustomDatabase: "Personal Virtual Database",
    dbStatus: "Status",
    dbActive: "ACTIVE",
    dbType: "Type",
    dbCustom: "VIRTUAL",
    dbCapacity: "Capacity",
    dbUnlimited: "UNLIMITED",
    dbPlatform: "GTS", // Changed from NON-BASE44
    dbNonBase44: "GTS", // Changed for consistency
    advancedEncryption: "Advanced Encryption",
    autoBackup: "Auto Backup",
    highPerformance: "High Performance",
    fullDataOwnership: "Full Data Ownership",
    connectedToCustomDB: "Connected to Virtual DB",
    allDataSecurelyStored: "All data securely stored",
    dataLog: "Data Log",
    dataLogDesc: "View secure audit logs"
  },
  ar: {
    appTitle: "منشئ الاختبارات GTS",
    appSubtitle: "إدارة الاختبارات الشخصية",
    navigation: "التنقل",
    dashboard: "لوحة التحكم",
    dashboardDesc: "إدارة جميع الاختبارات",
    quizBuilder: "منشئ الاختبارات",
    quizBuilderDesc: "إنشاء اختبار جديد",
    submissions: "الإجابات",
    submissionsDesc: "عرض الردود",
    questionBank: "بنك الأسئلة",
    questionBankDesc: "أسئلة قابلة للإعادة الاستخدام",
    status: "الحالة",
    systemStatus: "حالة النظام",
    operational: "✅ يعمل",
    autoSave: "الحفظ التلقائي",
    active: "🔄 نشط",
    logOut: "تسجيل الخروج",
    switchLanguage: "التبديل إلى الإنجليزية",
    customDatabase: "قاعدة البيانات الافتراضية GTS",
    unlimitedStorage: "تخزين غير محدود",
    personalCustomDatabase: "قاعدة بيانات افتراضية شخصية",
    dbStatus: "الحالة",
    dbActive: "نشط",
    dbType: "النوع",
    dbCustom: "افتراضية",
    dbCapacity: "السعة",
    dbUnlimited: "لا نهائي",
    dbPlatform: "GTS", // Changed from NON-BASE44
    dbNonBase44: "GTS", // Changed for consistency
    advancedEncryption: "تشفير متقدم",
    autoBackup: "نسخ احتياطي تلقائي",
    highPerformance: "أداء عالي السرعة",
    fullDataOwnership: "ملكية كاملة للبيانات",
    connectedToCustomDB: "متصل بقاعدة البيانات الافتراضية",
    allDataSecurelyStored: "جميع البيانات محفوظة بأمان",
    dataLog: "سجل البيانات",
    dataLogDesc: "عرض سجلات التدقيق الآمنة"
  }
};

const navigationItems = {
  en: [
    {
      title: "Dashboard",
      url: createPageUrl("Dashboard"),
      icon: LayoutIcon,
      description: "Manage all quizzes"
    },
    {
      title: "Quiz Builder",
      url: createPageUrl("QuizBuilder"),
      icon: Plus,
      description: "Create new quiz"
    },
    {
      title: "Submissions",
      url: createPageUrl("Submissions"),
      icon: BarChart3,
      description: "View responses"
    },
    {
      title: "Question Bank",
      url: createPageUrl("QuestionBank"),
      icon: Database,
      description: "Reusable questions"
    },
    {
      title: "Query",
      url: createPageUrl("Query"),
      icon: FileText,
      description: "Export detailed reports"
    },
    {
      title: "Data Log",
      url: createPageUrl("DataLog"),
      icon: History,
      description: "View secure audit logs"
    }
  ],
  ar: [
    {
      title: "لوحة التحكم",
      url: createPageUrl("DashboardAR"),
      icon: LayoutIcon,
      description: "إدارة جميع الاختبارات"
    },
    {
      title: "منشئ الاختبارات",
      url: createPageUrl("QuizBuilderAR"),
      icon: Plus,
      description: "إنشاء اختبار جديد"
    },
    {
      title: "الإجابات",
      url: createPageUrl("SubmissionsAR"),
      icon: BarChart3,
      description: "عرض الردود"
    },
    {
      title: "بنك الأسئلة",
      url: createPageUrl("QuestionBankAR"),
      icon: Database,
      description: "أسئلة قابلة للإعادة الاستخدام"
    },
    {
      title: "الاستعلام",
      url: createPageUrl("QueryAR"),
      icon: FileText,
      description: "تصدير تقارير مفصلة"
    },
    {
      title: "سجل البيانات",
      url: createPageUrl("DataLogAR"),
      icon: History,
      description: "عرض سجلات التدقيق الآمنة"
    }
  ]
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [language, setLanguage] = useState(() => {
    const arabicPages = ['DashboardAR', 'QuizBuilderAR', 'SubmissionsAR', 'QuestionBankAR', 'QueryAR', 'DataLogAR', 'PreviewAR', 'TakeQuizAR'];
    return arabicPages.includes(currentPageName) ? 'ar' : 'en';
  });

  const t = translations[language];
  const navItems = navigationItems[language];

  const adminPages = [
    'Dashboard', 'DashboardAR',
    'QuizBuilder', 'QuizBuilderAR',
    'Submissions', 'SubmissionsAR',
    'QuestionBank', 'QuestionBankAR',
    'Query', 'QueryAR',
    'DataLog', 'DataLogAR' // Added for new page
  ];

  const isAdminPage = adminPages.includes(currentPageName);
  const isPublicQuizPage = ['TakeQuiz', 'TakeQuizAR', 'Preview', 'PreviewAR'].includes(currentPageName);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (isAdminPage) {
      const checkAuth = () => {
        const session = localStorage.getItem('gts_user_session');
        if (session) {
          try {
            const userData = JSON.parse(session);
            setUser(userData);
          } catch (error) {
            console.error("Invalid session data:", error);
            localStorage.removeItem('gts_user_session');
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setIsCheckingAuth(false);
      };

      checkAuth();
    } else {
      setIsCheckingAuth(false);
    }
  }, [currentPageName, isAdminPage]);

  const handleLogout = () => {
    localStorage.removeItem('gts_user_session');
    setUser(null);
    window.location.reload();
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const switchLanguage = () => {
    if (language === 'en') {
      const arabicPageMap = {
        'Dashboard': 'DashboardAR',
        'QuizBuilder': 'QuizBuilderAR',
        'Submissions': 'SubmissionsAR',
        'QuestionBank': 'QuestionBankAR',
        'Query': 'QueryAR',
        'DataLog': 'DataLogAR', // Added for new page
        'TakeQuiz': 'TakeQuizAR',
        'Preview': 'PreviewAR'
      };
      const arabicPage = arabicPageMap[currentPageName] || 'DashboardAR';
      window.location.href = createPageUrl(arabicPage);
    } else {
      const englishPageMap = {
        'DashboardAR': 'Dashboard',
        'QuizBuilderAR': 'QuizBuilder',
        'SubmissionsAR': 'Submissions',
        'QuestionBankAR': 'QuestionBank',
        'QueryAR': 'Query',
        'DataLogAR': 'DataLog', // Added for new page
        'TakeQuizAR': 'TakeQuiz',
        'PreviewAR': 'Preview'
      };
      const englishPage = englishPageMap[currentPageName] || 'Dashboard';
      window.location.href = createPageUrl(englishPage);
    }
  };

  const backgroundImageUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/765cc97fb_9e12b837-8df9-4230-9dc3-6fa94740aa0c.png';
  const backgroundStyle = {
    backgroundImage: `url('${backgroundImageUrl}')`,
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '400px auto',
    backgroundAttachment: 'fixed',
    backgroundColor: '#f8fafc'
  };

  // Layout for public quiz pages
  if (isPublicQuizPage) {
    return (
      <div className="min-h-screen relative" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        
        {/* --- NUCLEAR CSS OVERRIDE FOR BASE44 REMOVAL --- */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* NUCLEAR OVERRIDE: Hide Base44 with maximum specificity */
            * * * * * * * * * * .base44-branding,
            * * * * * * * * * * .edit-with-base44,
            * * * * * * * * * * [data-base44-editor-controls],
            * * * * * * * * * * #base44-builder-button,
            * * * * * * * * * * [data-testid="edit-button"],
            * * * * * * * * * * .base44-edit-button,
            * * * * * * * * * * button[onclick*="base44"],
            * * * * * * * * * * a[href*="base44"],
            * * * * * * * * * * *[data-base44],
            * * * * * * * * * * iframe[src*="base44"],
            * * * * * * * * * * [class*="base44"],
            * * * * * * * * * * [id*="base44"],
            * * * * * * * * * * div[class*="edit"],
            * * * * * * * * * * button[class*="edit"],
            html body * * * * * * * * * .base44-branding,
            html body * * * * * * * * * .edit-with-base44,
            html body * * * * * * * * * [data-base44-editor-controls],
            html body * * * * * * * * * #base44-builder-button,
            html body * * * * * * * * * [data-testid="edit-button"],
            html body * * * * * * * * * .base44-edit-button,
            html body * * * * * * * * * button[onclick*="base44"],
            html body * * * * * * * * * a[href*="base44"],
            html body * * * * * * * * * *[data-base44],
            html body * * * * * * * * * iframe[src*="base44"],
            html body * * * * * * * * * [class*="base44"],
            html body * * * * * * * * * [id*="base44"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
              position: absolute !important;
              left: -99999px !important;
              top: -99999px !important;
              width: 0 !important;
              height: 0 !important;
              overflow: hidden !important;
              z-index: -999999 !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              background: transparent !important;
              color: transparent !important;
              font-size: 0 !important;
              line-height: 0 !important;
              text-indent: -99999px !important;
              clip: rect(0, 0, 0, 0) !important;
              -webkit-clip-path: polygon(0 0, 0 0, 0 0, 0 0) !important;
              clip-path: polygon(0 0, 0 0, 0 0, 0 0) !important;
            }

            /* Extra aggressive hiding for any remaining elements */
            body *[class*="edit"]:not(.gts-edit-replica):not([class*="editor"]):not([class*="editing"]) {
              display: none !important;
            }
            
            /* Create the replacement GTS logo */
            .gts-edit-replica {
              position: fixed !important;
              bottom: 15px !important;
              right: 15px !important;
              width: 200px !important;
              height: 70px !important;
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%) !important;
              color: white !important;
              border: 3px solid rgba(255, 255, 255, 0.2) !important;
              border-radius: 16px !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif !important;
              font-size: 36px !important;
              font-weight: 800 !important;
              letter-spacing: 3px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              z-index: 2147483647 !important;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(59, 130, 246, 0.4) !important;
              cursor: default !important;
              user-select: none !important;
              opacity: 1 !important;
              visibility: visible !important;
              pointer-events: none !important;
              backdrop-filter: blur(10px) !important;
              animation: gtsGlow 3s ease-in-out infinite alternate !important;
            }
            
            @keyframes gtsGlow {
              0% { box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(59, 130, 246, 0.4); }
              100% { box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4), 0 12px 24px rgba(59, 130, 246, 0.6); }
            }
          `
        }} />
        
        <div className="gts-edit-replica">GTS</div>
        
        <div className="w-full max-w-4xl mx-auto quiz-content relative z-10">
          {children}
        </div>
      </div>
    );
  }

  // For admin pages - check authentication
  if (isAdminPage) {
    if (isCheckingAuth) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return <UserAuth onLoginSuccess={handleLoginSuccess} />;
    }
  }

  // Layout for authenticated admin pages
  return (
    <LanguageContext.Provider value={{ language, switchLanguage, t }}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full relative" style={backgroundStyle}>
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]"></div>

          {/* --- NUCLEAR CSS OVERRIDE FOR ADMIN PANEL --- */}
          <style dangerouslySetInnerHTML={{
            __html: `
              /* NUCLEAR OVERRIDE: Hide Base44 elements in admin panel */
              * * * * * * * * * * .base44-branding,
              * * * * * * * * * * .edit-with-base44,
              * * * * * * * * * * [data-base44-editor-controls],
              * * * * * * * * * * #base44-builder-button,
              * * * * * * * * * * [data-testid="edit-button"],
              * * * * * * * * * * .base44-edit-button,
              * * * * * * * * * * button[onclick*="base44"],
              * * * * * * * * * * a[href*="base44"],
              * * * * * * * * * * *[data-base44],
              * * * * * * * * * * iframe[src*="base44"],
              * * * * * * * * * * [class*="base44"],
              * * * * * * * * * * [id*="base44"],
              html body * * * * * * * * * .base44-branding,
              html body * * * * * * * * * .edit-with-base44,
              html body * * * * * * * * * [data-base44-editor-controls],
              html body * * * * * * * * * #base44-builder-button,
              html body * * * * * * * * * [data-testid="edit-button"],
              html body * * * * * * * * * .base44-edit-button,
              html body * * * * * * * * * button[onclick*="base44"],
              html body * * * * * * * * * a[href*="base44"],
              html body * * * * * * * * * *[data-base44],
              html body * * * * * * * * * iframe[src*="base44"],
              html body * * * * * * * * * [class*="base44"],
              html body * * * * * * * * * [id*="base44"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -99999px !important;
                top: -99999px !important;
                width: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                z-index: -999999 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                background: transparent !important;
                color: transparent !important;
                font-size: 0 !important;
                line-height: 0 !important;
                text-indent: -99999px !important;
                clip: rect(0, 0, 0, 0) !important;
                -webkit-clip-path: polygon(0 0, 0 0, 0 0, 0 0) !important;
                clip-path: polygon(0 0, 0 0, 0 0, 0 0) !important;
              }

              /* Extra aggressive hiding for admin panel */
              body *[class*="edit"]:not(.gts-admin-replica):not([class*="editor"]):not([class*="editing"]) {
                display: none !important;
              }

              /* Create the GTS brand element for the admin panel */
              .gts-admin-replica {
                position: fixed !important;
                bottom: 15px !important;
                right: 15px !important;
                width: 200px !important;
                height: 70px !important;
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%) !important;
                color: white !important;
                border: 3px solid rgba(255, 255, 255, 0.2) !important;
                border-radius: 16px !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif !important;
                font-size: 36px !important;
                font-weight: 800 !important;
                letter-spacing: 3px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 2147483647 !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(59, 130, 246, 0.4) !important;
                cursor: default !important;
                user-select: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: none !important;
                backdrop-filter: blur(10px) !important;
                animation: gtsGlow 3s ease-in-out infinite alternate !important;
              }
              
              @keyframes gtsGlow {
                0% { box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(59, 130, 246, 0.4); }
                100% { box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4), 0 12px 24px rgba(59, 130, 246, 0.6); }
              }
            `
          }} />

          <div className="gts-admin-replica">GTS</div>

          <Sidebar className="border-r border-slate-200/60 bg-white/90 backdrop-blur-xl relative z-10">
            <SidebarHeader className="border-b border-slate-200/60 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg tracking-tight">{t.appTitle}</h2>
                  <p className="text-xs text-slate-500 font-medium">{t.appSubtitle}</p>
                </div>
              </div>

              <Button
                onClick={switchLanguage}
                variant="outline"
                size="sm"
                className="mt-3 gap-2 w-full justify-center"
              >
                <Globe className="w-4 h-4" />
                {t.switchLanguage}
              </Button>
            </SidebarHeader>

            <SidebarContent className="p-3">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-2">
                  {t.navigation}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg ${
                            location.pathname === item.url ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-700'
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3 py-3 group">
                            <item.icon className="w-4 h-4 transition-colors" />
                            <div className="flex-1">
                              <span className="font-medium">{item.title}</span>
                              <p className="text-xs text-slate-500 group-hover:text-blue-600 transition-colors">
                                {item.description}
                              </p>
                            </div>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-2">
                  {t.status}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-600">{t.systemStatus}</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {t.operational}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-600">{t.autoSave}</span>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {t.active}
                      </Badge>
                    </div>
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-2">
                  {t.customDatabase}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-4">
                    {/* Unlimited Storage Badge */}
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-3 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <Database className="w-4 h-4" />
                        <span className="text-sm font-bold">
                          {t.unlimitedStorage}
                        </span>
                      </div>
                      <p className="text-xs opacity-90">
                        {t.personalCustomDatabase}
                      </p>
                    </div>

                    {/* Database Status */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          {t.dbStatus}
                        </span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          ✨ {t.dbActive}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          {t.dbType}
                        </span>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                          {t.dbCustom}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          {t.dbCapacity}
                        </span>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                          ∞ {t.dbUnlimited}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          {t.dbPlatform}
                        </span>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                          {t.dbNonBase44}
                        </Badge>
                      </div>
                    </div>

                    {/* Database Features */}
                    <div className="bg-slate-50 rounded-md p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-slate-700">
                          {t.advancedEncryption}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-slate-700">
                          {t.autoBackup}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-slate-700">
                          {t.highPerformance}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-slate-700">
                          {t.fullDataOwnership}
                        </span>
                      </div>
                    </div>

                    {/* Connection Indicator */}
                    <div className="bg-green-50 border border-green-200 rounded-md p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-green-800">
                          {t.connectedToCustomDB}
                        </span>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        {t.allDataSecurelyStored}
                      </p>
                    </div>
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-slate-200/60 p-4">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-slate-50">
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-inner">
                          <UserIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-semibold text-slate-900 text-sm truncate">{user.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <LogOut className="w-4 h-4 mr-2" />
                      {t.logOut}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                  </div>
                </div>
              )}
            </SidebarFooter>
          </Sidebar>

          <main className="flex-1 flex flex-col relative z-10">
            <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 md:hidden">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
                <h1 className="text-xl font-bold text-slate-900">{t.appTitle}</h1>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </LanguageContext.Provider>
  );
}

export { LanguageContext };

