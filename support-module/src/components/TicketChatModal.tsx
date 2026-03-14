import React, { useEffect, useState } from "react";

interface Props {
  ticketId: string;
  onClose: () => void;
}

const TicketChatModal: React.FC<Props> = ({ ticketId, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    const res = await fetch(
      `http://localhost:5000/api/tickets/${ticketId}/messages`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    await fetch(
      `http://localhost:5000/api/tickets/${ticketId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessage }),
      }
    );

    setNewMessage("");
    fetchMessages();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
      <div className="bg-white w-full max-w-lg rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4">Ticket Chat</h2>

        <div className="h-64 overflow-y-auto border rounded p-3 space-y-2 mb-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className="text-xs text-gray-500">
                {msg.sender_role}
              </div>
              <div className="bg-gray-100 p-2 rounded text-sm">
                {msg.message}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-indigo-600 text-white rounded"
          >
            Send
          </button>
        </div>

        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="text-gray-500 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketChatModal;