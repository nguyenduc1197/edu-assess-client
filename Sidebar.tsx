import React, { useState } from 'react';
import AddQuestionMenu from './AddQuestionMenu';

const Sidebar = () => {
    const [showQuestionsMenu, setShowQuestionsMenu] = useState(false);
    const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);

    const handleCreateQuestionClick = () => {
        setShowAddQuestionModal(true);
    };

    return (
        <div className='sidebar'>
            <button onClick={() => setShowQuestionsMenu(!showQuestionsMenu)}>Questions</button>
            {showQuestionsMenu && (
                <div>
                    <p onClick={handleCreateQuestionClick}>Tạo Câu Hỏi</p>
                    <p>Danh Sách Câu Hỏi</p>
                </div>
            )}
            {showAddQuestionModal && <AddQuestionMenu onClose={() => setShowAddQuestionModal(false)} />}
        </div>
    );
};

export default Sidebar;