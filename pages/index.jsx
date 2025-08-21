import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import QuizBuilder from "./QuizBuilder";

import Preview from "./Preview";

import Submissions from "./Submissions";

import QuestionBank from "./QuestionBank";

import TakeQuiz from "./TakeQuiz";

import DashboardAR from "./DashboardAR";

import QuizBuilderAR from "./QuizBuilderAR";

import SubmissionsAR from "./SubmissionsAR";

import QuestionBankAR from "./QuestionBankAR";

import TakeQuizAR from "./TakeQuizAR";

import PreviewAR from "./PreviewAR";

import Query from "./Query";

import QueryAR from "./QueryAR";

import DataLog from "./DataLog";

import DataLogAR from "./DataLogAR";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    QuizBuilder: QuizBuilder,
    
    Preview: Preview,
    
    Submissions: Submissions,
    
    QuestionBank: QuestionBank,
    
    TakeQuiz: TakeQuiz,
    
    DashboardAR: DashboardAR,
    
    QuizBuilderAR: QuizBuilderAR,
    
    SubmissionsAR: SubmissionsAR,
    
    QuestionBankAR: QuestionBankAR,
    
    TakeQuizAR: TakeQuizAR,
    
    PreviewAR: PreviewAR,
    
    Query: Query,
    
    QueryAR: QueryAR,
    
    DataLog: DataLog,
    
    DataLogAR: DataLogAR,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/QuizBuilder" element={<QuizBuilder />} />
                
                <Route path="/Preview" element={<Preview />} />
                
                <Route path="/Submissions" element={<Submissions />} />
                
                <Route path="/QuestionBank" element={<QuestionBank />} />
                
                <Route path="/TakeQuiz" element={<TakeQuiz />} />
                
                <Route path="/DashboardAR" element={<DashboardAR />} />
                
                <Route path="/QuizBuilderAR" element={<QuizBuilderAR />} />
                
                <Route path="/SubmissionsAR" element={<SubmissionsAR />} />
                
                <Route path="/QuestionBankAR" element={<QuestionBankAR />} />
                
                <Route path="/TakeQuizAR" element={<TakeQuizAR />} />
                
                <Route path="/PreviewAR" element={<PreviewAR />} />
                
                <Route path="/Query" element={<Query />} />
                
                <Route path="/QueryAR" element={<QueryAR />} />
                
                <Route path="/DataLog" element={<DataLog />} />
                
                <Route path="/DataLogAR" element={<DataLogAR />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}