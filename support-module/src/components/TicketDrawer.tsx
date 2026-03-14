
import React, { useState } from "react";

interface Props {
  ticket: any;
  onClose: () => void;
}

export const TicketDrawer: React.FC<Props> = ({
  ticket,
  onClose,
}) => {
  const [status, setStatus] = useState(ticket.status);
  const [comment, setComment] = useState("");

  const handleStatusUpdate = () => {
    // Call your backend API here
    console.log("Updating status to:", status);
  };

  const handleAddComment = () => {
    // Call backend comment API here
    console.log("Adding comment:", comment);
    setComment("");
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50">

      <div className="w-full max-w-lg bg-white h-full shadow-2xl p-8 overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Ticket Details
          </h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Ticket Info */}
        <div className="space-y-4 text-sm mb-8">

          <Info label="Merchant" value={ticket.merchant_name} />
          <Info label="Module" value={ticket.module} />
          <Info label="Title" value={ticket.title} />
          <Info label="Description" value={ticket.description} />
          <Info label="Current Status" value={ticket.status} />

        </div>

        {/* Change Status */}
        <div className="mb-8">
          <h3 className="font-medium text-gray-700 mb-2">
            Update Status
          </h3>

          <div className="flex gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <button
              onClick={handleStatusUpdate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Update
            </button>
          </div>
        </div>

        {/* Add Comment */}
        <div>
          <h3 className="font-medium text-gray-700 mb-2">
            Add Internal Note
          </h3>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border rounded-lg p-3 text-sm"
            rows={4}
            placeholder="Write note here..."
          />

          <button
            onClick={handleAddComment}
            className="mt-3 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-black transition"
          >
            Save Note
          </button>
        </div>

      </div>
    </div>
  );
};

const Info = ({ label, value }: any) => (
  <div>
    <p className="text-gray-500 text-xs uppercase tracking-wide">
      {label}
    </p>
    <p className="text-gray-800 font-medium mt-1">
      {value || "—"}
    </p>
  </div>
);