import React from "react";
import styles from "./membership.module.css";

interface Plan {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
  description?: string;
  badge?: string;
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for getting started",
    features: ["Access basic features", "Community support", "Limited usage", "Basic templates"],
  },
  {
    name: "Basic",
    price: "$9",
    description: "Great for individuals",
    features: ["Everything in Free", "Priority email support", "Increased limits", "Advanced templates"],
  },
  {
    name: "Pro",
    price: "$29",
    description: "Perfect for professionals",
    features: ["Everything in Basic", "Advanced analytics", "Custom integrations", "Priority support"],
    highlight: true,
    badge: "Most Popular"
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: ["Everything in Pro", "Dedicated support", "Custom solutions", "SLA guarantee"],
  },
];

export default function MembershipPage() {
  return (
    <div className={styles.container}>
      <div className={styles.backgroundPattern}></div>
      
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>Choose Your Plan</h1>
          <p className={styles.subtitle}>
            Unlock the full potential of our platform with flexible pricing designed for every need
          </p>
        </div>

        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.planWrapper} ${plan.highlight ? styles.highlightedWrapper : ''}`}
            >
              <div className={`${styles.planCard} ${plan.highlight ? styles.highlightedCard : ''}`}>
                
                {plan.badge && (
                  <div className={styles.badge}>
                    <div className={styles.badgeContent}>
                      {plan.badge}
                    </div>
                  </div>
                )}

                {plan.highlight && (
                  <div className={styles.glowEffect}></div>
                )}

                <div className={styles.cardContent}>

                  <h3 className={styles.planName}>{plan.name}</h3>
                  
                  <p className={styles.planDescription}>{plan.description}</p>

                  <div className={styles.priceSection}>
                    <div className={styles.priceWrapper}>
                      <span className={styles.price}>{plan.price}</span>
                      {plan.name !== "Enterprise" && (
                        <span className={styles.period}>/month</span>
                      )}
                    </div>
                  </div>

                  <ul className={styles.features}>
                    {plan.features.map((feature, i) => (
                      <li key={i} className={styles.feature}>
                        <svg className={styles.checkIcon} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className={styles.featureText}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button className={`${styles.button} ${plan.highlight ? styles.primaryButton : styles.secondaryButton}`}>
                    {plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                  </button>
                </div>

                {plan.highlight && (
                  <div className={styles.borderAnimation}>
                    <div className={styles.animatedBorder}></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.bottomCta}>
          <p className={styles.ctaText}>Need help choosing? We're here to help!</p>
          <button className={styles.ctaButton}>
            Talk to Sales
          </button>
        </div>
      </div>
    </div>
  );
}