import React from "react";
import { getInitials } from "@/utils/mapHelpers";

interface ActiveUser {
  userId: string;
  userName: string;
  userAvatar?: string;
  highlightColor: string;
}

interface ActiveUsersIndicatorProps {
  activeUsers: ActiveUser[];
  isConnected: boolean;
}

/**
 * Component to display active users with their avatars in the map editor
 */
export const ActiveUsersIndicator: React.FC<ActiveUsersIndicatorProps> = ({
  activeUsers,
  isConnected,
}) => {
  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 mr-2">
      {/* Show first 3 users */}
      {activeUsers.slice(0, 3).map((user) => (
        <div
          key={user.userId}
          className="relative group"
          title={user.userName}
        >
          {user.userAvatar ? (
            <img
              src={user.userAvatar}
              alt={user.userName}
              className="w-8 h-8 rounded-full border-2 border-white/30 object-cover"
              style={{ borderColor: user.highlightColor }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold text-white"
              style={{
                backgroundColor: user.highlightColor,
                borderColor: user.highlightColor,
              }}
            >
              {getInitials(user.userName)}
            </div>
          )}
        </div>
      ))}

      {/* Show "+N" indicator if more than 3 users */}
      {activeUsers.length > 3 && (
        <div
          className="w-8 h-8 rounded-full border-2 border-white/30 bg-zinc-700 flex items-center justify-center text-xs font-semibold text-white"
          title={`${activeUsers.length - 3} more user(s)`}
        >
          +{activeUsers.length - 3}
        </div>
      )}

      {/* Connection status indicator */}
      {isConnected && (
        <div className="flex items-center gap-1 ml-1">
          <div
            className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
            title="Connected"
          />
        </div>
      )}
    </div>
  );
};
