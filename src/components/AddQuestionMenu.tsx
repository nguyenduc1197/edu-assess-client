import React from 'react';

const AddQuestionMenu = () => {
  return (
    <div className="bg-white p-4 rounded shadow-md">
      <h2 className="text-xl font-bold mb-4">Add Question</h2>
      <input
        type="text"
        placeholder="Enter your question"
        className="border border-gray-300 rounded p-2 mb-4 w-full"
      />
      <button className="bg-blue-500 text-white rounded p-2">Add Question</button>
    </div>
  );
};

export default AddQuestionMenu;