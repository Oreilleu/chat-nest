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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setInputMessage('');
  };

  const handleTyping = () => {
    if (!socket || !currentRoom) return;
    socket.emit('typing', { roomId: currentRoom.id, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomId: currentRoom.id, isTyping: false });
    }, 1000);
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
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '200px', borderRight: '1px solid #ccc', padding: '10px' }}>
        <h3>Rooms</h3>
        {rooms.map((room) => (
          <div
            key={room.id}
            onClick={() => setCurrentRoom(room)}
            style={{
              padding: '8px',
              cursor: 'pointer',
              backgroundColor: currentRoom?.id === room.id ? '#e0e0e0' : 'transparent',
            }}
          >
            {room.name}
          </div>
        ))}
        <button
          onClick={() => setShowCreateRoom(true)}
          style={{ marginTop: '10px', padding: '8px', width: '100%' }}
        >
          Create Room
        </button>
        <button
          onClick={() => setShowProfile(true)}
          style={{ marginTop: '10px', padding: '8px', width: '100%' }}
        >
          Profile
        </button>
        <button onClick={logout} style={{ marginTop: '10px', padding: '8px', width: '100%' }}>
          Logout
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentRoom && (
          <>
            <div style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{currentRoom.name}</h2>
              {!currentRoom.isGeneral && (
                <button
                  onClick={() => setShowAddUser(true)}
                  style={{ padding: '5px 10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + Add User
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {messages.map((msg) => {
                const reactionCounts = msg.reactions.reduce((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {} as { [emoji: string]: number });

                return (
                  <div key={msg.id} style={{ marginBottom: '15px', position: 'relative' }} onMouseEnter={(e) => {
                    const btn = e.currentTarget.querySelector('.reaction-btn') as HTMLElement;
                    if (btn) btn.style.display = 'inline-block';
                  }} onMouseLeave={(e) => {
                    const btn = e.currentTarget.querySelector('.reaction-btn') as HTMLElement;
                    if (btn) btn.style.display = 'none';
                  }}>
                    <div>
                      <span style={{ color: msg.user.color, fontWeight: 'bold' }}>
                        {msg.user.username}
                      </span>
                      <span style={{ marginLeft: '10px', fontSize: '12px', color: '#999' }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>{msg.content}</div>
                    <div style={{ marginTop: '5px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <span
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          style={{
                            padding: '2px 8px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '12px',
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          {emoji} {count}
                        </span>
                      ))}
                      <button
                        className="reaction-btn"
                        onClick={(e) => {
                          const menu = e.currentTarget.nextElementSibling as HTMLElement;
                          menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
                        }}
                        style={{ display: 'none', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px' }}
                      >
                        +
                      </button>
                      <div style={{ display: 'none', gap: '5px', position: 'absolute', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', padding: '5px', zIndex: 10 }}>
                        {['👍', '❤️', '😂', '😮'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              handleReaction(msg.id, emoji);
                              (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                            }}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px' }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingList.length > 0 && (
                <div style={{ fontStyle: 'italic', color: '#666' }}>
                  {typingList.length === 1
                    ? `${typingList[0]} est en train d'écrire...`
                    : `${typingList.join(', ')} sont en train d'écrire...`}
                </div>
              )}
            </div>
            <div style={{ padding: '10px', borderTop: '1px solid #ccc', display: 'flex' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button
                onClick={handleSendMessage}
                style={{ marginLeft: '10px', padding: '8px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Send
              </button>
            </div>
          </>
        )}
        {!currentRoom && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            Select a room
          </div>
        )}
      </div>

      {showProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '300px' }}>
            <h3>Profile</h3>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button
              onClick={handleUpdateProfile}
              style={{ width: '100%', padding: '8px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}
            >
              Save
            </button>
            <button
              onClick={() => setShowProfile(false)}
              style={{ width: '100%', padding: '8px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCreateRoom && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '300px' }}>
            <h3>Create Room</h3>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name"
              style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <div style={{ marginBottom: '10px' }}>
              {availableUsers.map((u) => (
                <div key={u.id} style={{ marginBottom: '5px' }}>
                  <label>
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
                    />
                    {u.username}
                  </label>
                  {selectedUsers.includes(u.id) && (
                    <label style={{ marginLeft: '10px' }}>
                      <input
                        type="checkbox"
                        checked={historyAccess[u.id] || false}
                        onChange={(e) =>
                          setHistoryAccess({ ...historyAccess, [u.id]: e.target.checked })
                        }
                      />
                      History
                    </label>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleCreateRoom}
              style={{ width: '100%', padding: '8px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateRoom(false)}
              style={{ width: '100%', padding: '8px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAddUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '300px' }}>
            <h3>Add Users to {currentRoom?.name}</h3>
            <div style={{ marginBottom: '10px' }}>
              {availableUsers.map((u) => (
                <div key={u.id} style={{ marginBottom: '5px' }}>
                  <label>
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
                    />
                    {u.username}
                  </label>
                  {selectedUsers.includes(u.id) && (
                    <label style={{ marginLeft: '10px' }}>
                      <input
                        type="checkbox"
                        checked={historyAccess[u.id] !== false}
                        onChange={(e) =>
                          setHistoryAccess({ ...historyAccess, [u.id]: e.target.checked })
                        }
                      />
                      History
                    </label>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleAddUserToRoom}
              style={{ width: '100%', padding: '8px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddUser(false);
                setSelectedUsers([]);
                setHistoryAccess({});
              }}
              style={{ width: '100%', padding: '8px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
