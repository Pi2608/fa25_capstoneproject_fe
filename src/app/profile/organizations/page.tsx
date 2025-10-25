"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface OrganizationData {
  name: string;
  role: string;
  plan: string;
  credits: number;
  members: string[];
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgData, setOrgData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load organization data from localStorage
    const name = localStorage.getItem("org_name");
    const role = localStorage.getItem("org_role");
    const planData = localStorage.getItem("org_plan");
    const credits = localStorage.getItem("org_credits");
    const members = localStorage.getItem("org_members");

    if (name && role && planData) {
      try {
        const plan = JSON.parse(planData);
        const memberData = members ? JSON.parse(members) : { emails: [] };
        
        setOrgData({
          name,
          role,
          plan: plan.type,
          credits: parseInt(credits || "0"),
          members: memberData.emails || []
        });
      } catch (error) {
        console.error("Error parsing organization data:", error);
        // Set default values if parsing fails
        setOrgData({
          name: name || "My Organization",
          role: role || "owner",
          plan: "basic",
          credits: parseInt(credits || "0"),
          members: []
        });
      }
    }
    
    setLoading(false);
  }, []);

  const handleCreateMap = () => {
    // Navigate to create new map
    router.push("/maps/new");
  };

  const handleViewOrganization = () => {
    // Navigate to organization detail (you'll need to create this route)
    router.push("/profile/organizations/1"); // Using placeholder ID
  };

  const handleClearData = () => {
    // Clear organization setup data
    localStorage.removeItem("org_name");
    localStorage.removeItem("org_role");
    localStorage.removeItem("org_plan");
    localStorage.removeItem("org_credits");
    localStorage.removeItem("org_members");
    localStorage.removeItem("account_type");
    
    // Redirect to create organization
    router.push("/profile/create-org");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!orgData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">No Organization Found</h1>
          <p className="text-gray-400 mb-6">It seems your organization setup wasn't completed.</p>
          <Link 
            href="/profile/create-org"
            className="inline-block px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Create Organization
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-white font-bold text-xl">IMOS</span>
            </Link>
            <div className="text-gray-400">
              Welcome to your organization!
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎉 Organization Setup Complete!
          </h1>
          <p className="text-gray-400 text-lg">
            Your organization <span className="text-green-400 font-semibold">{orgData.name}</span> is ready to use.
          </p>
        </div>

        {/* Organization Summary */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Organization Summary</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-2">Organization Name</h3>
              <p className="text-white font-semibold">{orgData.name}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-2">Your Role</h3>
              <p className="text-white font-semibold capitalize">{orgData.role}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-2">Plan</h3>
              <p className="text-white font-semibold capitalize">{orgData.plan}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-2">Credits</h3>
              <p className="text-white font-semibold">${orgData.credits}</p>
            </div>
          </div>
        </div>

        {/* Members */}
        {orgData.members.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Invited Members</h2>
            <div className="space-y-2">
              {orgData.members.map((email, index) => (
                <div key={index} className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-sm">{email.charAt(0).toUpperCase()}</span>
                  </div>
                  <span>{email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleCreateMap}
            className="px-8 py-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>🗺️</span>
            Create Your First Map
          </button>
          
          <button
            onClick={handleViewOrganization}
            className="px-8 py-4 border border-gray-600 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <span>👥</span>
            View Organization
          </button>
        </div>

        {/* Debug/Reset Button */}
        <div className="mt-8 text-center">
          <button
            onClick={handleClearData}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Reset Organization Setup
          </button>
        </div>

        {/* Quick Tips */}
        <div className="mt-12 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Tips</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-xl">💡</span>
              <div>
                <h4 className="text-white font-medium">Start Creating Maps</h4>
                <p className="text-gray-400 text-sm">Use our intuitive map editor to create custom maps for your organization.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-xl">👥</span>
              <div>
                <h4 className="text-white font-medium">Collaborate with Team</h4>
                <p className="text-gray-400 text-sm">Invite team members and work together on map projects.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-xl">📊</span>
              <div>
                <h4 className="text-white font-medium">Track Usage</h4>
                <p className="text-gray-400 text-sm">Monitor your organization's map usage and credits.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-xl">⚙️</span>
              <div>
                <h4 className="text-white font-medium">Manage Settings</h4>
                <p className="text-gray-400 text-sm">Configure organization settings and member permissions.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
