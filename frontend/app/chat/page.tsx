'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { Message, Room, User } from '@/lib/types';
import { api } from '@/lib/api';

export default function ChatPage() {
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const currentRoomRef = useRef<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<{ [key: number]: string }>({});
  const [showProfile, setShowProfile] = useState(false);
  const [username, setUsername] = useState('');
  const [color, setColor] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [historyAccess, setHistoryAccess] = useState<{ [key: number]: boolean }>({});
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!user || !token) {
      router.push('/');
      return;
    }

    const s = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      auth: { token },
    });

    s.on('connect', () => {
      setSocket(s);
      s.emit('getRooms');
    });

    s.on('userRooms', (userRooms: Room[]) => {
      setRooms(userRooms);
      if (userRooms.length > 0 && !currentRoom) {
        setCurrentRoom(userRooms[0]);
      }
    });

    s.on('newMessage', (message: Message & { room: Room }) => {
      if (currentRoomRef.current && message.room.id === currentRoomRef.current.id) {
        setMessages((prev) => [...prev, message]);
      }
    });

    s.on('userTyping', ({ roomId, userId, username, isTyping }: { roomId: number; userId: number; username: string; isTyping: boolean }) => {
      if (currentRoomRef.current && roomId === currentRoomRef.current.id) {
        setTypingUsers((prev) => {
          const updated = { ...prev };
          if (isTyping) {
            updated[userId] = username;
          } else {
            delete updated[userId];
          }
          return updated;
        });
      }
    });

    s.on('reactionAdded', (reaction: any) => {
      if (!reaction) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === reaction.message.id
            ? { ...msg, reactions: [...msg.reactions, reaction] }
            : msg
        )
      );
    });

    s.on('reactionRemoved', (data: { messageId: number; reactionId: number }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, reactions: msg.reactions.filter(r => r.id !== data.reactionId) }
            : msg
        )
      );
    });

    s.on('roomMessages', (msgs: Message[]) => {
      setMessages(msgs);
    });

    s.on('roomCreated', (room: Room) => {
      setRooms((prev) => [...prev, room]);
      s.emit('getRooms');
    });

    return () => {
      s.disconnect();
    };
  }, [user, token, router]);

  useEffect(() => {
    if (socket && currentRoom) {
      currentRoomRef.current = currentRoom;
      setMessages([]);
      setTypingUsers({});
      socket.emit('joinRoom', { roomId: currentRoom.id });
    }
  }, [socket, currentRoom]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setColor(user.color);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      api.getAllUsers(token).then(users => {
        setAvailableUsers(users.filter((u: User) => u.id !== user?.id));
      }).catch(console.error);
    }
  }, [token, user]);

  const handleSendMessage = () => {
    if (!socket || !currentRoom || !inputMessage.trim()) return;
    socket.emit('sendMessage', { roomId: currentRoom.id, content: inputMessage });
    socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
    setInputMessage('');
  };

  const handleTyping = (value: string) => {
    if (!socket || !currentRoom) return;
    const hasText = value.trim().length > 0;
    socket.emit('typing', { roomId: currentRoom.id, isTyping: hasText });
  };

  const handleReaction = (messageId: number, emoji: string) => {
    if (!socket) return;
    socket.emit('addReaction', { messageId, emoji });
  };

  const handleUpdateProfile = async () => {
    if (!token) return;
    try {
      const updated = await api.updateProfile(token, { username, color });
      updateUser(updated);
      setShowProfile(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateRoom = () => {
    if (!socket || !newRoomName.trim() || selectedUsers.length === 0) return;
    socket.emit('createRoom', {
      name: newRoomName,
      userIds: selectedUsers,
      historyAccess,
    });
    setShowCreateRoom(false);
    setNewRoomName('');
    setSelectedUsers([]);
    setHistoryAccess({});
  };

  const handleAddUserToRoom = () => {
    if (!socket || !currentRoom || selectedUsers.length === 0) return;
    selectedUsers.forEach(userId => {
      socket.emit('addUserToRoom', {
        roomId: currentRoom.id,
        userId,
        hasHistoryAccess: historyAccess[userId] !== false,
      });
    });
    setShowAddUser(false);
    setSelectedUsers([]);
    setHistoryAccess({});
  };

  if (!user) return null;

  const typingList = Object.values(typingUsers);

  return (
    <div className="flex h-screen bg-[#111b21] font-sans">
      <div className="w-[300px] bg-[#111b21] border-r border-[#222d34] flex flex-col">
        <div className="px-4 py-3 bg-[#202c33] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: user.color }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-[#e9edef] font-medium">{user.username}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowProfile(true)} className="bg-transparent border-none text-[#aebac1] cursor-pointer text-xl">⚙</button>
            <button onClick={logout} className="bg-transparent border-none text-[#aebac1] cursor-pointer text-lg">↪</button>
          </div>
        </div>
        <div className="px-3 py-2">
          <button
            onClick={() => setShowCreateRoom(true)}
            className="w-full py-2.5 bg-[#00a884] text-[#111b21] border-none rounded-lg cursor-pointer font-semibold text-sm"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setCurrentRoom(room)}
              className={`px-4 py-3 cursor-pointer border-b border-[#222d34] flex items-center gap-3 ${currentRoom?.id === room.id ? 'bg-[#2a3942]' : 'bg-transparent hover:bg-[#202c33]'}`}
            >
              <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] font-bold text-lg">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[#e9edef] font-medium">{room.name}</div>
                <div className="text-[#8696a0] text-[13px]">{room.isGeneral ? 'General' : 'Private'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#0b141a]">
        {currentRoom ? (
          <>
            <div className="px-4 py-2.5 bg-[#202c33] flex justify-between items-center border-b border-[#222d34]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-[#111b21] font-bold">
                  {currentRoom.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[#e9edef] font-medium">{currentRoom.name}</div>
                  <div className="text-[#8696a0] text-[13px]">click to see group info</div>
                </div>
              </div>
              {!currentRoom.isGeneral && (
                <button
                  onClick={() => setShowAddUser(true)}
                  className="px-4 py-2 bg-[#00a884] text-[#111b21] border-none rounded-full cursor-pointer font-semibold text-[13px]"
                >
                  + Add
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-6 bg-[#0b141a]">
              <div className="flex flex-col gap-3">
                {messages.map((msg) => {
                  const isOwn = msg.user.id === user.id;
                  const reactionCounts = msg.reactions.reduce((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                    return acc;
                  }, {} as { [emoji: string]: number });

                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                      <div
                        style={{
                          maxWidth: '65%',
                          minWidth: '180px',
                          padding: '10px 14px 24px 14px',
                          position: 'relative',
                          backgroundColor: isOwn ? '#005c4b' : '#1f2c34',
                          borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}
                        className="group"
                      >
                        {!isOwn && (
                          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: msg.user.color }}>
                            {msg.user.username}
                          </div>
                        )}
                        <div style={{ color: '#e9edef', fontSize: '15px', lineHeight: '1.4', paddingRight: '50px' }}>{msg.content}</div>
                        <div style={{ position: 'absolute', bottom: '8px', right: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {Object.keys(reactionCounts).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(reactionCounts).map(([emoji, count]) => (
                              <span
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className="px-2 py-1 bg-[#ffffff15] rounded-full text-sm cursor-pointer text-[#e9edef] hover:bg-[#ffffff25]"
                              >
                                {emoji} {count}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            const menu = e.currentTarget.nextElementSibling as HTMLElement;
                            menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
                          }}
                          className="absolute top-2 -right-9 opacity-0 group-hover:opacity-100 bg-[#1f2c34] rounded-full w-8 h-8 flex items-center justify-center border-none cursor-pointer text-base transition-opacity shadow-md"
                        >
                          😊
                        </button>
                        <div className="hidden absolute -top-12 right-0 bg-[#233138] rounded-2xl px-3 py-2 gap-2 shadow-xl z-10">
                          {['👍', '❤️', '😂', '😮'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                handleReaction(msg.id, emoji);
                                (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                              }}
                              className="border-none bg-transparent cursor-pointer text-2xl hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {typingList.length > 0 && (
              <div className="px-6 py-2 bg-[#0b141a]">
                <div className="flex items-center gap-2 text-[#8696a0]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm">
                    {typingList.length === 1
                      ? `${typingList[0]} écrit...`
                      : `${typingList.join(', ')} écrivent...`}
                  </span>
                </div>
              </div>
            )}
            <div className="px-4 py-3 bg-[#202c33] flex gap-3 items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  handleTyping(e.target.value);
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message"
                className="flex-1 px-4 py-3 bg-[#2a3942] border-none rounded-lg text-[#e9edef] text-[15px] outline-none"
              />
              <button
                onClick={handleSendMessage}
                className="w-12 h-12 bg-[#00a884] border-none rounded-full cursor-pointer flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="#111b21"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-[#8696a0]">
            <div className="text-[32px] mb-4">💬</div>
            <div className="text-xl font-light">Select a chat to start messaging</div>
          </div>
        )}
      </div>

      {showProfile && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-[#111b21] p-6 rounded-xl w-[340px] border border-[#222d34]">
            <h3 className="text-[#e9edef] mb-5 font-medium">Profile Settings</h3>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-3 mb-3 bg-[#2a3942] border-none rounded-lg text-[#e9edef] text-sm outline-none box-border"
            />
            <div className="mb-3">
              <label className="text-[#8696a0] text-[13px] block mb-2">Your color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 border-none rounded-lg cursor-pointer"
              />
            </div>
            <button
              onClick={handleUpdateProfile}
              className="w-full p-3 bg-[#00a884] text-[#111b21] border-none rounded-lg cursor-pointer font-semibold text-sm mb-2"
            >
              Save
            </button>
            <button
              onClick={() => setShowProfile(false)}
              className="w-full p-3 bg-[#2a3942] text-[#e9edef] border-none rounded-lg cursor-pointer text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-[#111b21] p-6 rounded-xl w-[340px] border border-[#222d34]">
            <h3 className="text-[#e9edef] mb-5 font-medium">Create New Chat</h3>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Chat name"
              className="w-full p-3 mb-4 bg-[#2a3942] border-none rounded-lg text-[#e9edef] text-sm outline-none box-border"
            />
            <div className="mb-4 max-h-[200px] overflow-y-auto">
              <label className="text-[#8696a0] text-[13px] block mb-2">Add participants</label>
              {availableUsers.map((u) => (
                <div key={u.id} className={`p-2 rounded-lg mb-1 flex items-center justify-between ${selectedUsers.includes(u.id) ? 'bg-[#2a3942]' : 'bg-transparent'}`}>
                  <label className="flex items-center gap-2.5 cursor-pointer text-[#e9edef]">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, u.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter((id) => id !== u.id));
                        }
                      }}
                      className="accent-[#00a884]"
                    />
                    {u.username}
                  </label>
                  {selectedUsers.includes(u.id) && (
                    <label className="flex items-center gap-1.5 text-[#8696a0] text-xs">
                      <input
                        type="checkbox"
                        checked={historyAccess[u.id] || false}
                        onChange={(e) => setHistoryAccess({ ...historyAccess, [u.id]: e.target.checked })}
                        className="accent-[#00a884]"
                      />
                      History
                    </label>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleCreateRoom}
              className="w-full p-3 bg-[#00a884] text-[#111b21] border-none rounded-lg cursor-pointer font-semibold text-sm mb-2"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateRoom(false)}
              className="w-full p-3 bg-[#2a3942] text-[#e9edef] border-none rounded-lg cursor-pointer text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
          <div className="bg-[#111b21] p-6 rounded-xl w-[340px] border border-[#222d34]">
            <h3 className="text-[#e9edef] mb-5 font-medium">Add to {currentRoom?.name}</h3>
            <div className="mb-4 max-h-[200px] overflow-y-auto">
              {availableUsers.map((u) => (
                <div key={u.id} className={`p-2 rounded-lg mb-1 flex items-center justify-between ${selectedUsers.includes(u.id) ? 'bg-[#2a3942]' : 'bg-transparent'}`}>
                  <label className="flex items-center gap-2.5 cursor-pointer text-[#e9edef]">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, u.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter((id) => id !== u.id));
                        }
                      }}
                      className="accent-[#00a884]"
                    />
                    {u.username}
                  </label>
                  {selectedUsers.includes(u.id) && (
                    <label className="flex items-center gap-1.5 text-[#8696a0] text-xs">
                      <input
                        type="checkbox"
                        checked={historyAccess[u.id] !== false}
                        onChange={(e) => setHistoryAccess({ ...historyAccess, [u.id]: e.target.checked })}
                        className="accent-[#00a884]"
                      />
                      History
                    </label>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleAddUserToRoom}
              className="w-full p-3 bg-[#00a884] text-[#111b21] border-none rounded-lg cursor-pointer font-semibold text-sm mb-2"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddUser(false);
                setSelectedUsers([]);
                setHistoryAccess({});
              }}
              className="w-full p-3 bg-[#2a3942] text-[#e9edef] border-none rounded-lg cursor-pointer text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
