"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlans, type Plan } from "@/lib/api";

export default function PricingPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const router = useRouter();

    useEffect(() => {
        async function fetchPlans() {
            try {
                const data = await getPlans();
                setPlans(data);
            } catch (err: any) {
                setError(err.message || "Failed to fetch plans.");
            } finally {
                setLoading(false);
            }
        }
        fetchPlans();
    }, []);

    const handleGetStarted = () => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
        } else {
            alert("Already logged in! Proceeding with plan...");
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-[#0D1912] via-[#0D1117] to-[#000000] text-white py-20">
            <div className="max-w-7xl mx-auto text-center">
                <h1 className="text-4xl font-bold mb-4">Pricing Plans</h1>
                <p className="text-zinc-400 mb-12">
                    Start free. Upgrade when you need more collaboration, storage, and advanced export options.
                </p>

                {loading ? (
                    <p className="text-zinc-400">Loading plans...</p>
                ) : error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {plans.map((plan) => (
                            <div
                                key={plan.planId}
                                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl hover:scale-105 transition-transform duration-300"
                            >
                                <div>
                                    <h3 className="text-2xl font-semibold mb-2">{plan.planName}</h3>
                                    <p className="text-sm text-zinc-400 mb-6">{plan.description}</p>
                                </div>

                                <div>
                                    <p className="text-3xl font-bold">
                                        {plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}`}
                                        <span className="text-sm font-normal text-zinc-400"> /month</span>
                                    </p>

                                    <button
                                        className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium transition-colors shadow"
                                        onClick={() => handleGetStarted(plan.planName)}
                                    >
                                        Get started
                                    </button>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
