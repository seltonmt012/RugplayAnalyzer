// ==UserScript==
// @name         RugPlay Market Analyzer - Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Advanced market analysis tool for RugPlay with portfolio tracking and rugpull detection
// @author       seltonmt012
// @match        https://rugplay.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      rugplay.com
// ==/UserScript==

(function() {
    'use strict';

    // ===========================
    // Configuration & Storage
    // ===========================

    // Get API key from storage
    const getApiKey = () => {
        return GM_getValue('rugplay_api_key', '');
    };

    const saveApiKey = (key) => {
        GM_setValue('rugplay_api_key', key);
    };

    // API base URL
    const API_BASE_URL = 'https://rugplay.com/api/v1';

    // Portfolio storage structure
    const getPortfolio = () => {
        return GM_getValue('rugplay_portfolio', {});
    };

    // FIX: Changed GM_getValue to GM_setValue to properly save the portfolio
const savePortfolio = (portfolio) => {
    try {
        console.log('Saving portfolio data:', portfolio);
        GM_setValue('rugplay_portfolio', portfolio);
        console.log('Portfolio saved successfully');
    } catch (error) {
        console.error('Error saving portfolio:', error);
        showNotification('Error saving data: ' + error.message, 'error');
    }
};

    const addTransaction = (symbol, quantity, price, date = new Date()) => {
        const portfolio = getPortfolio();

        if (!portfolio[symbol]) {
            portfolio[symbol] = {
                transactions: [],
                notes: ''
            };
        }

        portfolio[symbol].transactions.push({
            id: Date.now() + Math.random().toString(36).substring(2, 9), // Generate unique ID
            quantity: parseFloat(quantity),
            price: parseFloat(price),
            date: date.toISOString(),
            type: quantity > 0 ? 'buy' : 'sell'
        });

        savePortfolio(portfolio);
        updateUI();
    };

// Fix for the delete transaction function
const deleteTransaction = (symbol, transactionId) => {
    try {
        console.log(`Deleting transaction: ${symbol} - ${transactionId}`);
        const portfolio = getPortfolio();

        if (!portfolio[symbol] || !portfolio[symbol].transactions) {
            console.error(`No transactions found for ${symbol}`);
            showNotification(`No transactions found for ${symbol}`, 'error');
            return false;
        }

        const transactionIndex = portfolio[symbol].transactions.findIndex(tx => tx.id === transactionId);

        if (transactionIndex === -1) {
            console.error(`Transaction not found: ${transactionId}`);
            showNotification('Transaction not found', 'error');
            return false;
        }

        // Log before deletion
        console.log(`Found transaction at index ${transactionIndex}, deleting...`);

        // Remove the transaction
        portfolio[symbol].transactions.splice(transactionIndex, 1);

        // If there are no more transactions for this symbol, remove the coin entry
        if (portfolio[symbol].transactions.length === 0) {
            console.log(`No more transactions for ${symbol}, removing coin entry`);
            delete portfolio[symbol];
        }

        // Save the updated portfolio
        savePortfolio(portfolio);

        console.log('Transaction deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showNotification('Error deleting transaction: ' + error.message, 'error');
        return false;
    }
};

    // Fix for transaction tab button event handlers
const setupTransactionTabEventListeners = () => {
    // Add event listeners for delete buttons
    document.querySelectorAll('[data-action="delete-tx"]').forEach(button => {
        button.addEventListener('click', () => {
            const symbol = button.dataset.symbol;
            const txId = button.dataset.txid;

            console.log(`Delete button clicked for transaction: ${symbol} - ${txId}`);

            showConfirmModal(
                'Delete Transaction',
                `Are you sure you want to delete this ${symbol} transaction? This action cannot be undone.`,
                () => {
                    const success = deleteTransaction(symbol, txId);
                    if (success) {
                        showNotification('Transaction deleted successfully', 'success');
                        updateTransactionsTab(); // Refresh the UI
                    } else {
                        showNotification('Failed to delete transaction', 'error');
                    }
                }
            );
        });
    });

    // Add event listeners for import/export buttons
    const exportButton = document.getElementById('rp-export-transactions');
    if (exportButton) {
        exportButton.addEventListener('click', exportTransactions);
    }

    const importButton = document.getElementById('rp-import-transactions');
    if (importButton) {
        importButton.addEventListener('click', () => showImportModal());
    }
};

    // Rest of the script remains unchanged...

    const calculateHoldings = (symbol) => {
        const portfolio = getPortfolio();
        if (!portfolio[symbol]) return { quantity: 0, avgPrice: 0 };

        let totalQuantity = 0;
        let totalCost = 0;

        portfolio[symbol].transactions.forEach(tx => {
            if (tx.type === 'buy') {
                totalCost += (tx.quantity * tx.price);
                totalQuantity += tx.quantity;
            } else {
                const avgCostPerCoin = totalCost / totalQuantity;
                totalCost -= (tx.quantity * avgCostPerCoin);
                totalQuantity -= tx.quantity;
            }
        });

        return {
            quantity: totalQuantity,
            avgPrice: totalQuantity > 0 ? totalCost / totalQuantity : 0
        };
    };

    // ===========================
    // API Functions
// Fix for the confirmation modal that's causing the error
const showConfirmModal = (title, message, onConfirm) => {
    try {
        // Remove any existing modals first
        const existingModal = document.getElementById('rp-confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create the modal directly with DOM methods instead of innerHTML
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'rp-modal-backdrop';
        modalBackdrop.id = 'rp-confirm-modal';

        const modalDiv = document.createElement('div');
        modalDiv.className = 'rp-modal';

        const modalTitle = document.createElement('div');
        modalTitle.className = 'rp-modal-title';
        modalTitle.textContent = title;

        const modalContent = document.createElement('div');
        modalContent.className = 'rp-modal-content';

        const modalMessage = document.createElement('p');
        modalMessage.textContent = message;

        const modalActions = document.createElement('div');
        modalActions.className = 'rp-modal-actions';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'rp-analyzer-button';
        cancelButton.id = 'rp-confirm-cancel';
        cancelButton.style.backgroundColor = '#555';
        cancelButton.textContent = 'Cancel';

        const confirmButton = document.createElement('button');
        confirmButton.className = 'rp-analyzer-button';
        confirmButton.id = 'rp-confirm-ok';
        confirmButton.style.backgroundColor = '#f55';
        confirmButton.textContent = 'Confirm';

        // Build the modal structure
        modalContent.appendChild(modalMessage);
        modalActions.appendChild(cancelButton);
        modalActions.appendChild(confirmButton);

        modalDiv.appendChild(modalTitle);
        modalDiv.appendChild(modalContent);
        modalDiv.appendChild(modalActions);

        modalBackdrop.appendChild(modalDiv);

        // Add the modal to the document
        document.body.appendChild(modalBackdrop);

        // Attach event listeners after the element is in the DOM
        cancelButton.addEventListener('click', () => {
            modalBackdrop.remove();
            showNotification('Action cancelled', 'warning');
        });

        confirmButton.addEventListener('click', () => {
            try {
                onConfirm();
                modalBackdrop.remove();
            } catch (error) {
                console.error('Error in confirmation action:', error);
                showNotification('Error: ' + error.message, 'error');
                modalBackdrop.remove();
            }
        });
    } catch (error) {
        console.error('Error showing modal:', error);
        showNotification('Error showing confirmation dialog: ' + error.message, 'error');
    }
};
    const fetchCoinData = async (symbol) => {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('API key not set. Please configure your API key in settings.');
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/coin/${symbol}`,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        resolve(JSON.parse(response.responseText));
                    } else if (response.status === 401) {
                        reject('Invalid API key. Please check your API key in settings.');
                    } else {
                        reject(`Error fetching coin data: ${response.statusText}`);
                    }
                },
                onerror: (error) => {
                    reject(`Network error: ${error}`);
                }
            });
        });
    };

    const fetchCoinHolders = async (symbol) => {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('API key not set. Please configure your API key in settings.');
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/holders/${symbol}?limit=50`,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        resolve(JSON.parse(response.responseText));
                    } else if (response.status === 401) {
                        reject('Invalid API key. Please check your API key in settings.');
                    } else {
                        reject(`Error fetching holder data: ${response.statusText}`);
                    }
                },
                onerror: (error) => {
                    reject(`Network error: ${error}`);
                }
            });
        });
    };

    const searchCoins = async (searchTerm) => {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('API key not set. Please configure your API key in settings.');
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/market?search=${encodeURIComponent(searchTerm)}`,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        resolve(JSON.parse(response.responseText));
                    } else if (response.status === 401) {
                        reject('Invalid API key. Please check your API key in settings.');
                    } else {
                        reject(`Error searching coins: ${response.statusText}`);
                    }
                },
                onerror: (error) => {
                    reject(`Network error: ${error}`);
                }
            });
        });
    };
    // Fix for the settings tab button event handlers
const setupSettingsTabEventListeners = () => {
    const saveApiKeyButton = document.getElementById('rp-save-api-key');
    if (saveApiKeyButton) {
        saveApiKeyButton.addEventListener('click', () => {
            const key = document.getElementById('rp-api-key').value.trim();
            if (!key) {
                showNotification('API key cannot be empty', 'error');
                return;
            }

            saveApiKey(key);
            showNotification('API key saved successfully', 'success');

            // Switch to coin tab
            document.querySelector('[data-tab="coin"]').click();
        });
    }

    const toggleKeyVisibilityButton = document.getElementById('rp-toggle-key-visibility');
    if (toggleKeyVisibilityButton) {
        toggleKeyVisibilityButton.addEventListener('click', () => {
            const input = document.getElementById('rp-api-key');
            if (input.type === 'password') {
                input.type = 'text';
                toggleKeyVisibilityButton.textContent = '🔒';
            } else {
                input.type = 'password';
                toggleKeyVisibilityButton.textContent = '👁️';
            }
        });
    }

    const exportPortfolioButton = document.getElementById('rp-export-portfolio');
    if (exportPortfolioButton) {
        exportPortfolioButton.addEventListener('click', exportTransactions);
    }

    const importPortfolioButton = document.getElementById('rp-import-portfolio');
    if (importPortfolioButton) {
        importPortfolioButton.addEventListener('click', () => {
            showImportModal();
        });
    }

    const clearPortfolioButton = document.getElementById('rp-clear-portfolio');
    if (clearPortfolioButton) {
        clearPortfolioButton.addEventListener('click', () => {
            showConfirmModal(
                'Clear Portfolio Data',
                'Are you sure you want to clear all portfolio data? This will delete all your transactions and cannot be undone.',
                () => {
                    try {
                        console.log('Clearing portfolio data...');
                        savePortfolio({});
                        showNotification('Portfolio data cleared successfully', 'success');

                        // Update the UI to reflect the cleared portfolio
                        if (document.querySelector('[data-tab="portfolio"]').classList.contains('active')) {
                            updatePortfolioTab();
                        }
                    } catch (error) {
                        console.error('Error clearing portfolio:', error);
                        showNotification('Error clearing portfolio: ' + error.message, 'error');
                    }
                }
            );
        });
    }
};

    // ===========================
    // Analysis Functions
    // ===========================

    const analyzePrice = (candlesticks) => {
        if (!candlesticks || candlesticks.length < 10) {
            return {
                trend: 'UNKNOWN',
                trendPercentage: 0,
                message: 'Insufficient data for analysis'
            };
        }

        // Get the last 10 candles
        const recentCandles = candlesticks.slice(-10);

        // Calculate the percentage change
        const firstPrice = recentCandles[0].open;
        const lastPrice = recentCandles[recentCandles.length - 1].close;
        const changePercentage = ((lastPrice - firstPrice) / firstPrice) * 100;

        // Count up candles
        const upCandles = recentCandles.filter(candle => candle.close > candle.open).length;

        let trend, message;

        if (changePercentage > 50) {
            trend = 'UP';
            message = 'Uptrend, last 10 candles up ' + formatNumber(Math.abs(changePercentage)) + '%';
        } else if (changePercentage < -20) {
            trend = 'DOWN';
            message = 'Downtrend, last 10 candles down ' + formatNumber(Math.abs(changePercentage)) + '%';
        } else if (upCandles >= 7) {
            trend = 'BULLISH';
            message = 'Bullish pattern, ' + upCandles + '/10 recent candles are up';
        } else if (upCandles <= 3) {
            trend = 'BEARISH';
            message = 'Bearish pattern, only ' + upCandles + '/10 recent candles are up';
        } else {
            trend = 'NEUTRAL';
            message = 'Sideways movement, no clear trend';
        }

        return {
            trend,
            trendPercentage: changePercentage,
            message
        };
    };

    const analyzeRisk = (coinData, holdersData) => {
        if (!holdersData || !holdersData.holders || !coinData) {
            return {
                riskLevel: 'UNKNOWN',
                riskScore: 0,
                factors: [],
                message: 'Insufficient data for risk analysis'
            };
        }

        const factors = [];
        let riskScore = 0;

        // Check holder concentration
        const topHolder = holdersData.holders[0];
        const topHolderPercentage = topHolder ? topHolder.percentage : 0;

        if (topHolderPercentage > 80) {
            factors.push({
                factor: `Top holder owns ${topHolderPercentage.toFixed(2)}%`,
                score: 8,
                description: 'Extremely high concentration'
            });
            riskScore += 8;
        } else if (topHolderPercentage > 50) {
            factors.push({
                factor: `Top holder owns ${topHolderPercentage.toFixed(2)}%`,
                score: 5,
                description: 'High concentration'
            });
            riskScore += 5;
        } else if (topHolderPercentage > 30) {
            factors.push({
                factor: `Top holder owns ${topHolderPercentage.toFixed(2)}%`,
                score: 3,
                description: 'Moderate concentration'
            });
            riskScore += 3;
        }

        // Check top 5 holders concentration
        const top5Holders = holdersData.holders.slice(0, 5);
        const top5Percentage = top5Holders.reduce((sum, holder) => sum + holder.percentage, 0);

        if (top5Percentage > 95) {
            factors.push({
                factor: `Top 5 holders own ${top5Percentage.toFixed(2)}%`,
                score: 8,
                description: 'Extremely high concentration'
            });
            riskScore += 8;
        } else if (top5Percentage > 80) {
            factors.push({
                factor: `Top 5 holders own ${top5Percentage.toFixed(2)}%`,
                score: 5,
                description: 'High concentration'
            });
            riskScore += 5;
        } else if (top5Percentage > 60) {
            factors.push({
                factor: `Top 5 holders own ${top5Percentage.toFixed(2)}%`,
                score: 3,
                description: 'Moderate concentration'
            });
            riskScore += 3;
        }

        // Check pool health
        const poolPercentage = (holdersData.poolInfo.coinAmount / holdersData.circulatingSupply) * 100;

        if (poolPercentage < 1) {
            factors.push({
                factor: `Pool is low (${poolPercentage.toFixed(3)}% of supply)`,
                score: 4,
                description: 'Very low liquidity'
            });
            riskScore += 4;
        } else if (poolPercentage < 5) {
            factors.push({
                factor: `Pool is moderate (${poolPercentage.toFixed(2)}% of supply)`,
                score: 2,
                description: 'Low liquidity'
            });
            riskScore += 2;
        }

        // Check price volatility
        const priceChange24h = coinData.coin.change24h;
        const currentPrice = coinData.coin.currentPrice;
        const changePercentage = (priceChange24h / (currentPrice - priceChange24h)) * 100;

        if (Math.abs(changePercentage) > 100) {
            factors.push({
                factor: `Major price movement detected`,
                score: 2,
                description: 'Extreme volatility'
            });
            riskScore += 2;
        } else if (Math.abs(changePercentage) > 50) {
            factors.push({
                factor: `Significant price volatility`,
                score: 1,
                description: 'High volatility'
            });
            riskScore += 1;
        }

        // Age of the coin
        const creationDate = new Date(coinData.coin.createdAt);
        const now = new Date();
        const ageInDays = (now - creationDate) / (1000 * 60 * 60 * 24);

        if (ageInDays < 1) {
            factors.push({
                factor: `New coin (less than 1 day old)`,
                score: 3,
                description: 'Very new project'
            });
            riskScore += 3;
        } else if (ageInDays < 7) {
            factors.push({
                factor: `Recent coin (less than 1 week old)`,
                score: 1,
                description: 'New project'
            });
            riskScore += 1;
        }

        // Determine risk level
        let riskLevel, recommendation;

        if (riskScore >= 12) {
            riskLevel = 'HIGH';
            recommendation = '⛔ HIGH RISK - Exercise extreme caution';
        } else if (riskScore >= 7) {
            riskLevel = 'MEDIUM';
            recommendation = '⚠️ MEDIUM RISK - Proceed with caution';
        } else if (riskScore >= 3) {
            riskLevel = 'LOW';
            recommendation = '🔶 LOW RISK - Standard precautions advised';
        } else {
            riskLevel = 'MINIMAL';
            recommendation = '✅ MINIMAL RISK - Appears relatively safe';
        }

        return {
            riskLevel,
            riskScore,
            factors,
            recommendation,
            holderAnalysis: {
                topHolder: topHolderPercentage,
                top5Holders: top5Percentage,
                poolPercentage
            }
        };
    };

    // ===========================
    // UI Components
    // ===========================

    // Add CSS styles
    const addStyles = () => {
        GM_addStyle(`
            .rp-analyzer {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 600px;
                max-height: 85vh;
                overflow-y: auto;
                background-color: #1a1a1a;
                color: #eee;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0,0,0,0.7);
                font-family: 'Arial', sans-serif;
                z-index: 10000;
                padding: 15px;
                scrollbar-width: thin;
                scrollbar-color: #444 #222;
            }

            .rp-analyzer::-webkit-scrollbar {
                width: 8px;
            }

            .rp-analyzer::-webkit-scrollbar-track {
                background: #222;
            }

            .rp-analyzer::-webkit-scrollbar-thumb {
                background-color: #444;
                border-radius: 10px;
            }

            .rp-analyzer * {
                box-sizing: border-box;
            }

            .rp-analyzer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
            }

            .rp-analyzer-title {
                font-size: 18px;
                font-weight: bold;
                color: #0df;
            }

            .rp-analyzer-close {
                cursor: pointer;
                color: #aaa;
                font-size: 20px;
            }

            .rp-analyzer-close:hover {
                color: #fff;
            }

            .rp-analyzer-tabs {
                display: flex;
                border-bottom: 1px solid #444;
                margin-bottom: 15px;
            }

            .rp-analyzer-tab {
                padding: 8px 15px;
                cursor: pointer;
                margin-right: 5px;
                font-size: 14px;
                border-radius: 5px 5px 0 0;
                background-color: #333;
                transition: all 0.2s ease;
            }

            .rp-analyzer-tab:hover {
                background-color: #3a3a3a;
            }

            .rp-analyzer-tab.active {
                background-color: #0df;
                color: #111;
                font-weight: bold;
            }

            .rp-analyzer-content {
                background-color: #222;
                border-radius: 5px;
                padding: 15px;
            }

            .rp-analyzer-section {
                margin-bottom: 20px;
                background-color: #2a2a2a;
                border-radius: 5px;
                padding: 12px;
            }

            .rp-analyzer-section-title {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 10px;
                color: #0df;
                border-bottom: 1px solid #444;
                padding-bottom: 5px;
            }

            .rp-analyzer-data-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 5px 0;
                border-bottom: 1px dotted #3a3a3a;
            }

            .rp-analyzer-label {
                color: #bbb;
            }

            .rp-analyzer-value {
                font-weight: bold;
            }

            .rp-analyzer-input {
                width: 100%;
                padding: 10px;
                background-color: #333;
                border: 1px solid #444;
                border-radius: 5px;
                color: #fff;
                margin-bottom: 10px;
                font-size: 14px;
            }

            .rp-analyzer-input:focus {
                outline: none;
                border-color: #0df;
            }

            .rp-analyzer-button {
                background-color: #0df;
                color: #111;
                padding: 8px 15px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                margin-right: 5px;
                transition: all 0.2s ease;
            }

            .rp-analyzer-button:hover {
                background-color: #0ad;
            }

            .rp-analyzer-button.rp-delete {
                background-color: #f55;
                padding: 5px 10px;
                font-size: 12px;
            }

            .rp-analyzer-button.rp-delete:hover {
                background-color: #f33;
            }

            .rp-positive {
                color: #0f8;
            }

            .rp-negative {
                color: #f55;
            }

            .rp-warning {
                color: #fa3;
            }

            .rp-neutral {
                color: #0df;
            }

            .rp-transaction-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
                font-size: 14px;
            }

            .rp-transaction-table th, .rp-transaction-table td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #444;
            }

            .rp-transaction-table th {
                background-color: #333;
                color: #0df;
            }

            .rp-transaction-table tr:hover {
                background-color: #2c2c2c;
            }

            .rp-chart-container {
                width: 100%;
                height: 180px;
                margin: 15px 0;
                background-color: #1a1a1a;
                border-radius: 5px;
                border: 1px solid #333;
            }

            .rp-toggle-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 55px;
                height: 55px;
                border-radius: 50%;
                background-color: #0df;
                color: #111;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 0 15px rgba(0,0,0,0.7);
                z-index: 10001;
                transition: all 0.3s ease;
                border: 2px solid #0ad;
                text-align: center;
                line-height: 55px;
            }

            .rp-toggle-button:hover {
                transform: scale(1.1);
                background-color: #0ad;
            }

            .rp-notification {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background-color: #222;
                color: #fff;
                padding: 12px 20px;
                border-radius: 5px;
                box-shadow: 0 0 15px rgba(0,0,0,0.7);
                z-index: 10002;
                font-weight: bold;
                transition: all 0.3s ease;
                border-left: 4px solid #0df;
            }

            .rp-notification.rp-error {
                border-left-color: #f55;
            }

            .rp-notification.rp-success {
                border-left-color: #0f8;
            }

            .rp-notification.rp-warning {
                border-left-color: #fa3;
            }

            .rp-risk-analysis {
                margin-top: 15px;
                padding: 15px;
                border-radius: 5px;
                background-color: #222;
                border: 1px solid #333;
            }

            .rp-risk-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
            }

            .rp-risk-high {
                color: #f55;
            }

            .rp-risk-medium {
                color: #fa3;
            }

            .rp-risk-low {
                color: #fc6;
            }

            .rp-risk-minimal {
                color: #0f8;
            }

            .rp-risk-factor {
                margin: 5px 0;
                padding: 5px 10px;
                background-color: #2a2a2a;
                border-radius: 3px;
                font-size: 14px;
                display: flex;
                justify-content: space-between;
            }

            .rp-risk-score {
                background-color: rgba(255,85,85,0.2);
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: 8px;
                font-size: 12px;
            }

            .rp-recommendation {
                margin-top: 15px;
                padding: 10px;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
                background-color: rgba(255,85,85,0.1);
                border: 1px solid rgba(255,85,85,0.3);
            }

            .rp-recommendation.rp-risk-medium {
                background-color: rgba(255,170,51,0.1);
                border: 1px solid rgba(255,170,51,0.3);
            }

            .rp-recommendation.rp-risk-low {
                background-color: rgba(255,204,102,0.1);
                border: 1px solid rgba(255,204,102,0.3);
            }

            .rp-recommendation.rp-risk-minimal {
                background-color: rgba(0,255,136,0.1);
                border: 1px solid rgba(0,255,136,0.3);
            }

            .rp-prediction {
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 15px;
                font-weight: bold;
                text-align: center;
            }

            .rp-prediction.rp-up {
                background-color: rgba(0,255,136,0.1);
                border: 1px solid rgba(0,255,136,0.3);
                color: #0f8;
            }

            .rp-prediction.rp-down {
                background-color: rgba(255,85,85,0.1);
                border: 1px solid rgba(255,85,85,0.3);
                color: #f55;
            }

            .rp-prediction.rp-neutral {
                background-color: rgba(0,221,255,0.1);
                border: 1px solid rgba(0,221,255,0.3);
                color: #0df;
            }

            .rp-prediction.rp-bullish {
                background-color: rgba(0,255,136,0.1);
                border: 1px solid rgba(0,255,136,0.3);
                color: #0f8;
            }

            .rp-prediction.rp-bearish {
                background-color: rgba(255,85,85,0.1);
                border: 1px solid rgba(255,85,85,0.3);
                color: #f55;
            }

            .rp-settings-row {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }

            .rp-settings-label {
                flex: 0 0 120px;
                color: #bbb;
            }

            .rp-settings-value {
                flex: 1;
            }

            .rp-api-key-input {
                position: relative;
            }

            .rp-api-key-show {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                color: #888;
            }

            .rp-api-key-show:hover {
                color: #0df;
            }

            .rp-empty-state {
                text-align: center;
                padding: 30px 0;
                color: #888;
            }

            .rp-empty-state-icon {
                font-size: 40px;
                margin-bottom: 15px;
                color: #444;
            }

            .rp-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.7);
                z-index: 10005;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .rp-modal {
                background-color: #222;
                padding: 20px;
                border-radius: 10px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 0 20px rgba(0,0,0,0.5);
            }

            .rp-modal-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #0df;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
            }

            .rp-modal-content {
                margin-bottom: 20px;
            }

            .rp-modal-actions {
                display: flex;
                justify-content: flex-end;
            }

            .rp-transactions-page-integration {
                background-color: #2a2a2a;
                border-radius: 5px;
                padding: 15px;
                margin-top: 15px;
                border-left: 4px solid #0df;
            }

            .rp-transactions-title {
                font-weight: bold;
                margin-bottom: 10px;
                color: #0df;
            }

            .rp-batch-actions {
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
                background-color: #333;
                padding: 10px;
                border-radius: 5px;
            }

            .rp-action-buttons {
                display: flex;
                gap: 5px;
            }

            .rp-pagination {
                display: flex;
                justify-content: center;
                margin-top: 15px;
                gap: 5px;
            }

            .rp-page-button {
                padding: 5px 10px;
                background-color: #333;
                border-radius: 3px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .rp-page-button:hover {
                background-color: #444;
            }

            .rp-page-button.active {
                background-color: #0df;
                color: #111;
                font-weight: bold;
            }

            .rp-import-export {
                margin-top: 20px;
            }

            .rp-import-export-title {
                font-weight: bold;
                margin-bottom: 10px;
                color: #0df;
            }

            .rp-import-export-buttons {
                display: flex;
                gap: 10px;
            }

            .rp-transaction-note {
                font-style: italic;
                font-size: 12px;
                color: #888;
                margin-top: 10px;
            }

            /* Responsive styles for smaller screens */
            @media (max-width: 768px) {
                .rp-analyzer {
                    width: 90%;
                    right: 5%;
                    max-height: 80vh;
                }

                .rp-toggle-button {
                    width: 45px;
                    height: 45px;
                    font-size: 20px;
                }
            }
        `);
    };

    // Create main UI container
    const createUI = () => {
        createToggleButton();

        // Create main container (initially hidden)
        const container = document.createElement('div');
        container.className = 'rp-analyzer';
        container.style.display = 'none';
        container.id = 'rp-analyzer-container';

        // Create header
        const header = document.createElement('div');
        header.className = 'rp-analyzer-header';

        const title = document.createElement('div');
        title.className = 'rp-analyzer-title';
        title.textContent = 'RugPlay Market Analyzer';

        const closeButton = document.createElement('div');
        closeButton.className = 'rp-analyzer-close';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', toggleAnalyzer);

        header.appendChild(title);
        header.appendChild(closeButton);

        // Create tabs
        const tabs = document.createElement('div');
        tabs.className = 'rp-analyzer-tabs';

        const coinTab = document.createElement('div');
        coinTab.className = 'rp-analyzer-tab active';
        coinTab.textContent = 'Analysis';
        coinTab.dataset.tab = 'coin';
        coinTab.addEventListener('click', (e) => switchTab(e.target));

        const portfolioTab = document.createElement('div');
        portfolioTab.className = 'rp-analyzer-tab';
        portfolioTab.textContent = 'Portfolio';
        portfolioTab.dataset.tab = 'portfolio';
        portfolioTab.addEventListener('click', (e) => switchTab(e.target));

        const transactionTab = document.createElement('div');
        transactionTab.className = 'rp-analyzer-tab';
        transactionTab.textContent = 'Transactions';
        transactionTab.dataset.tab = 'transactions';
        transactionTab.addEventListener('click', (e) => switchTab(e.target));

        const searchTab = document.createElement('div');
        searchTab.className = 'rp-analyzer-tab';
        searchTab.textContent = 'Search';
        searchTab.dataset.tab = 'search';
        searchTab.addEventListener('click', (e) => switchTab(e.target));

        const settingsTab = document.createElement('div');
        settingsTab.className = 'rp-analyzer-tab';
        settingsTab.textContent = '⚙️';
        settingsTab.dataset.tab = 'settings';
        settingsTab.title = 'Settings';
        settingsTab.addEventListener('click', (e) => switchTab(e.target));

        tabs.appendChild(coinTab);
        tabs.appendChild(portfolioTab);
        tabs.appendChild(transactionTab);
        tabs.appendChild(searchTab);
        tabs.appendChild(settingsTab);

        // Create content area
        const content = document.createElement('div');
        content.className = 'rp-analyzer-content';
        content.id = 'rp-analyzer-content';

        // Assemble UI
        container.appendChild(header);
        container.appendChild(tabs);
        container.appendChild(content);

        document.body.appendChild(container);

        // Check if API key is set
        const apiKey = getApiKey();
        if (!apiKey) {
            // If no API key, show settings tab first
            switchTab(settingsTab);
        } else {
            // Initial content
            updateCoinTab();
        }

        // Special handling for transactions page
        if (window.location.href.includes('rugplay.com/transactions')) {
            // If we're on the transactions page, auto-show the analyzer
            setTimeout(() => {
                if (container.style.display === 'none') {
                    toggleAnalyzer();
                    // Switch to transactions tab
                    switchTab(transactionTab);
                }
            }, 1000);
        }
    };

    // Create toggle button separately to ensure it's always visible
    const createToggleButton = () => {
        // Remove any existing button first to avoid duplicates
        const existingButton = document.getElementById('rp-toggle-button');
        if (existingButton) {
            existingButton.remove();
        }

        // Create new toggle button
        const toggleButton = document.createElement('div');
        toggleButton.className = 'rp-toggle-button';
        toggleButton.id = 'rp-toggle-button';
        toggleButton.innerHTML = '📊';
        toggleButton.title = 'Toggle RugPlay Analyzer';
        toggleButton.addEventListener('click', toggleAnalyzer);
        document.body.appendChild(toggleButton);

        // Ensure button is visible
        toggleButton.style.display = 'flex';
    };

    // Tab switching
    const switchTab = (tabElement) => {
        // Update active class
        document.querySelectorAll('.rp-analyzer-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        tabElement.classList.add('active');

        // Update content based on selected tab
        const tabName = tabElement.dataset.tab;

        switch (tabName) {
            case 'coin':
                updateCoinTab();
                break;
            case 'portfolio':
                updatePortfolioTab();
                break;
            case 'transactions':
                updateTransactionsTab();
                break;
            case 'search':
                updateSearchTab();
                break;
            case 'settings':
                updateSettingsTab();
                break;
        }
    };

    // Toggle analyzer visibility
    const toggleAnalyzer = () => {
        const container = document.getElementById('rp-analyzer-container');
        if (container.style.display === 'none') {
            container.style.display = 'block';

            // Check URL for coin
            const symbol = getCoinFromUrl();
            if (symbol) {
                loadCoinData(symbol);
            }
        } else {
            container.style.display = 'none';
        }
    };

    // Get coin symbol from URL
    const getCoinFromUrl = () => {
        const url = window.location.href;
        const coinMatch = url.match(/\/coin\/([A-Z0-9]+)/i);
        return coinMatch ? coinMatch[1] : null;
    };

    // Update UI with coin data
    const updateCoinTab = async () => {
        const content = document.getElementById('rp-analyzer-content');

        // Check if API key is set
        const apiKey = getApiKey();
        if (!apiKey) {
            content.innerHTML = `
                <div class="rp-analyzer-section">
                    <div class="rp-analyzer-section-title">API Key Required</div>
                    <p>Please configure your API key in the settings tab before using the analyzer.</p>
                    <button class="rp-analyzer-button" id="rp-goto-settings">Go to Settings</button>
                </div>
            `;

            document.getElementById('rp-goto-settings').addEventListener('click', () => {
                document.querySelector('[data-tab="settings"]').click();
            });

            return;
        }

        // Default content when no coin is selected
        let symbol = currentCoin || getCoinFromUrl();

        if (!symbol) {
            content.innerHTML = `
                <div class="rp-empty-state">
                    <div class="rp-empty-state-icon">🔍</div>
                    <div>No Coin Selected</div>
                    <p>Navigate to a coin page or search for a coin to analyze.</p>
                    <button class="rp-analyzer-button" id="rp-goto-search">Search Coins</button>
                </div>
            `;

            document.getElementById('rp-goto-search').addEventListener('click', () => {
                document.querySelector('[data-tab="search"]').click();
            });

            return;
        }

        // Loading state
        content.innerHTML = `
            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Loading ${symbol}...</div>
                <p>Fetching market data...</p>
                <div style="display: flex; justify-content: center; padding: 20px;">
                    <div style="width: 40px; height: 40px; border: 4px solid #333; border-top: 4px solid #0df; border-radius: 50%; animation: rp-spin 1s linear infinite;"></div>
                </div>
            </div>

            <style>
                @keyframes rp-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        try {
            await loadCoinData(symbol);
        } catch (error) {
            content.innerHTML = `
                <div class="rp-analyzer-section">
                    <div class="rp-analyzer-section-title">Error</div>
                    <p style="color: #f55;">${error}</p>
                    <button class="rp-analyzer-button" id="rp-retry-load">Retry</button>
                </div>
            `;

            document.getElementById('rp-retry-load').addEventListener('click', () => {
                updateCoinTab();
            });
        }
    };

    // Update transactions tab
    const updateTransactionsTab = () => {
        const content = document.getElementById('rp-analyzer-content');
        const portfolio = getPortfolio();

        // Check if we have any transactions
        let totalTransactions = 0;
        const allTransactions = [];

        Object.keys(portfolio).forEach(symbol => {
            if (portfolio[symbol].transactions) {
                portfolio[symbol].transactions.forEach(tx => {
                    allTransactions.push({
                        ...tx,
                        symbol
                    });
                    totalTransactions++;
                });
            }
        });

        // Sort transactions by date (newest first)
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (totalTransactions === 0) {
            content.innerHTML = `
                <div class="rp-empty-state">
                    <div class="rp-empty-state-icon">📝</div>
                    <div>No Transactions</div>
                    <p>You haven't recorded any transactions yet.</p>
                    <p>Go to a coin page and add a transaction to get started.</p>
                </div>

                <div class="rp-transactions-page-integration">
                    <div class="rp-transactions-title">RugPlay Transactions Page</div>
                    <p>You're currently on the RugPlay transactions page. This script creates a separate tracking system for your trades.</p>
                    <p>Unfortunately, the official transaction history on this page is not available through the API, so we can't automatically import it.</p>
                    <p>You'll need to manually add your transactions to use the analyzer's portfolio tracking features.</p>
                </div>
            `;
            return;
        }

        // Pagination setup
        const itemsPerPage = 10;
        const totalPages = Math.ceil(allTransactions.length / itemsPerPage);
        const currentPage = transactionsCurrentPage || 1;

        // Get transactions for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentTransactions = allTransactions.slice(startIndex, endIndex);

        content.innerHTML = `
            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Transaction History</div>

                <div class="rp-batch-actions">
                    <div>Total Transactions: ${totalTransactions}</div>
                    <div class="rp-action-buttons">
                        <button class="rp-analyzer-button" id="rp-export-transactions">Export</button>
                        <button class="rp-analyzer-button" id="rp-import-transactions">Import</button>
                    </div>
                </div>

                <table class="rp-transaction-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Coin</th>
                            <th>Type</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentTransactions.map(tx => `
                            <tr>
                                <td>${formatDate(tx.date)}</td>
                                <td>${tx.symbol}</td>
                                <td>${tx.type.toUpperCase()}</td>
                                <td>${formatNumberWithCommas(Math.abs(tx.quantity).toFixed(6))}</td>
                                <td>$${formatPrice(tx.price)}</td>
                                <td>$${formatNumberWithCommas((Math.abs(tx.quantity) * tx.price).toFixed(2))}</td>
                                <td>
                                    <button class="rp-analyzer-button rp-delete"
                                        data-symbol="${tx.symbol}"
                                        data-txid="${tx.id}"
                                        data-action="delete-tx">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${totalPages > 1 ? `
                    <div class="rp-pagination">
                        ${currentPage > 1 ? `
                            <div class="rp-page-button" data-page="${currentPage - 1}">❮</div>
                        ` : ''}

                        ${Array.from({length: totalPages}, (_, i) => i + 1).map(page => `
                            <div class="rp-page-button ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</div>
                        `).join('')}

                        ${currentPage < totalPages ? `
                            <div class="rp-page-button" data-page="${currentPage + 1}">❯</div>
                        ` : ''}
                    </div>
                ` : ''}

                <p class="rp-transaction-note">
                    Note: These transactions are stored locally in your browser and are separate from the official RugPlay transaction history.
                </p>
            </div>

            ${window.location.href.includes('rugplay.com/transactions') ? `
                <div class="rp-transactions-page-integration">
                    <div class="rp-transactions-title">RugPlay Transactions Page</div>
                    <p>You're currently on the RugPlay transactions page. The script provides a separate tracking system for your trades.</p>
                    <p>Unfortunately, the official transaction history on this page is not available through the API, so we can't automatically import it.</p>
                    <p>You can manually add transactions by going to a specific coin page and using the "Add Transaction" form.</p>
                </div>
            ` : ''}
        `;

        // Add event listeners for pagination
        document.querySelectorAll('.rp-page-button').forEach(button => {
            button.addEventListener('click', () => {
                transactionsCurrentPage = parseInt(button.dataset.page);
                updateTransactionsTab();
            });
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('[data-action="delete-tx"]').forEach(button => {
            button.addEventListener('click', () => {
                const symbol = button.dataset.symbol;
                const txId = button.dataset.txid;

                showConfirmModal(
                    'Delete Transaction',
                    `Are you sure you want to delete this ${symbol} transaction? This action cannot be undone.`,
                    () => {
                        const success = deleteTransaction(symbol, txId);
                        if (success) {
                            showNotification('Transaction deleted successfully', 'success');
                            updateTransactionsTab();
                        } else {
                            showNotification('Failed to delete transaction', 'error');
                        }
                    }
                );
            });
        });

        // Add event listeners for import/export buttons
        document.getElementById('rp-export-transactions').addEventListener('click', exportTransactions);
        document.getElementById('rp-import-transactions').addEventListener('click', () => showImportModal());
    };

    // Current page for transactions tab pagination
    let transactionsCurrentPage = 1;

    // Export transactions to JSON file
    const exportTransactions = () => {
        const portfolio = getPortfolio();
        const dataStr = JSON.stringify(portfolio, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `rugplay_portfolio_${formatDateFilename(new Date())}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        showNotification('Portfolio data exported successfully', 'success');
    };

    // Format date for filename (YYYY-MM-DD format)
    const formatDateFilename = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Show import modal
    const showImportModal = () => {
        const modalHTML = `
            <div class="rp-modal-backdrop" id="rp-import-modal">
                <div class="rp-modal">
                    <div class="rp-modal-title">Import Portfolio Data</div>
                    <div class="rp-modal-content">
                        <p>Select a JSON file containing your exported portfolio data:</p>
                        <input type="file" id="rp-import-file" accept=".json" class="rp-analyzer-input">
                        <p style="color: #fa3; margin-top: 10px;">Warning: This will overwrite your current portfolio data!</p>
                    </div>
                    <div class="rp-modal-actions">
                        <button class="rp-analyzer-button" id="rp-import-cancel" style="background-color: #555;">Cancel</button>
                        <button class="rp-analyzer-button" id="rp-import-confirm">Import</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to the document
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstChild);

        // Add event listeners
        document.getElementById('rp-import-cancel').addEventListener('click', () => {
            document.getElementById('rp-import-modal').remove();
        });
    setTimeout(() => {
        setupTransactionTabEventListeners();
    }, 100);
        document.getElementById('rp-import-confirm').addEventListener('click', () => {
            const fileInput = document.getElementById('rp-import-file');
            if (fileInput.files.length === 0) {
                showNotification('Please select a file to import', 'error');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    savePortfolio(data);
                    showNotification('Portfolio data imported successfully', 'success');
                    document.getElementById('rp-import-modal').remove();
                    updateTransactionsTab();
                } catch (error) {
                    showNotification('Error importing data: Invalid JSON format', 'error');
                }
            };

            reader.readAsText(file);
        });
    };


    // Update settings tab
    const updateSettingsTab = () => {
        const content = document.getElementById('rp-analyzer-content');
        const apiKey = getApiKey();

        content.innerHTML = `
            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">API Configuration</div>
                <p>Enter your RugPlay API key to access market data:</p>

                <div class="rp-settings-row">
                    <div class="rp-settings-label">API Key:</div>
                    <div class="rp-settings-value rp-api-key-input">
                        <input type="password" class="rp-analyzer-input" id="rp-api-key"
                            value="${apiKey}" placeholder="Enter your RugPlay API key here">
                        <span class="rp-api-key-show" id="rp-toggle-key-visibility">👁️</span>
                    </div>
                </div>

                <button class="rp-analyzer-button" id="rp-save-api-key">Save API Key</button>
            </div>

            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Portfolio Management</div>
                <div class="rp-import-export">
                    <div class="rp-import-export-title">Backup & Restore</div>
                    <p>Export your portfolio data to a file or import from a previous backup:</p>
                    <div class="rp-import-export-buttons">
                        <button class="rp-analyzer-button" id="rp-export-portfolio">Export Portfolio</button>
                        <button class="rp-analyzer-button" id="rp-import-portfolio">Import Portfolio</button>
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <button class="rp-analyzer-button rp-delete" id="rp-clear-portfolio">Clear Portfolio Data</button>
                </div>
            </div>

            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">About</div>
                <p>RugPlay Market Analyzer v1.3</p>
                <p>Created by: seltonmt012</p>
                <p>Last Updated: 2025-06-26</p>
            </div>
        `;

        // Add event listeners
        document.getElementById('rp-save-api-key').addEventListener('click', () => {
            const key = document.getElementById('rp-api-key').value.trim();
            if (!key) {
                showNotification('API key cannot be empty', 'error');
                return;
            }

            saveApiKey(key);
            showNotification('API key saved successfully', 'success');

            // Switch to coin tab
            document.querySelector('[data-tab="coin"]').click();
        });

        document.getElementById('rp-toggle-key-visibility').addEventListener('click', () => {
            const input = document.getElementById('rp-api-key');
            if (input.type === 'password') {
                input.type = 'text';
                document.getElementById('rp-toggle-key-visibility').textContent = '🔒';
            } else {
                input.type = 'password';
                document.getElementById('rp-toggle-key-visibility').textContent = '👁️';
            }
        });

        document.getElementById('rp-export-portfolio').addEventListener('click', exportTransactions);

        document.getElementById('rp-import-portfolio').addEventListener('click', () => {
            showImportModal();
        });

        // Add this code for the "Clear Portfolio Data" button in the settings tab
        document.getElementById('rp-clear-portfolio').addEventListener('click', () => {
            showConfirmModal(
            'Clear Portfolio Data',
            'Are you sure you want to clear all portfolio data? This will delete all your transactions and cannot be undone.',
            () => {
                try {
                console.log('Clearing portfolio data...');

                // Save an empty object as the portfolio
                savePortfolio({});

                console.log('Portfolio data cleared');
                showNotification('Portfolio data cleared successfully', 'success');

                // Force update the UI
                setTimeout(() => {
                    updatePortfolioTab();
                    showNotification('UI updated with empty portfolio', 'success');
                }, 500);
                } catch (error) {
                console.error('Error clearing portfolio:', error);
                showNotification('Error clearing portfolio: ' + error.message, 'error');
                }
            }
            );
        });
    };

    // Update portfolio tab content
    const updatePortfolioTab = () => {
        const content = document.getElementById('rp-analyzer-content');
        const portfolio = getPortfolio();
        const coins = Object.keys(portfolio);

        if (coins.length === 0) {
            content.innerHTML = `
                <div class="rp-empty-state">
                    <div class="rp-empty-state-icon">💼</div>
                    <div>Your Portfolio is Empty</div>
                    <p>You haven't added any coins to your portfolio yet.</p>
                    <p>Go to a coin page and add a transaction to get started.</p>
                </div>
            `;
            return;
        }

        let portfolioHTML = `
            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Your Portfolio</div>
                <table class="rp-transaction-table">
                    <thead>
                        <tr>
                            <th>Coin</th>
                            <th>Quantity</th>
                            <th>Avg Price</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        coins.forEach(symbol => {
            const holdings = calculateHoldings(symbol);
            if (holdings.quantity > 0) {
                portfolioHTML += `
                    <tr>
                        <td>${symbol}</td>
                        <td>${formatNumberWithCommas(holdings.quantity.toFixed(6))}</td>
                        <td>$${formatPrice(holdings.avgPrice)}</td>
                        <td>
                            <button class="rp-analyzer-button" data-symbol="${symbol}" data-action="view">View</button>
                        </td>
                    </tr>
                `;
            }
        });

        portfolioHTML += `
                    </tbody>
                </table>
            </div>

            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Transaction History</div>
                <select class="rp-analyzer-input" id="rp-transaction-coin">
                    <option value="">Select a coin</option>
                    ${coins.map(symbol => `<option value="${symbol}">${symbol}</option>`).join('')}
                </select>

                <div id="rp-transaction-history">
                    <p>Select a coin to view transaction history</p>
                </div>
            </div>
        `;

        content.innerHTML = portfolioHTML;

        // Add event listeners
        document.querySelectorAll('[data-action="view"]').forEach(button => {
            button.addEventListener('click', () => {
                const symbol = button.dataset.symbol;
                currentCoin = symbol;

                // Switch to coin tab and load data
                document.querySelector('[data-tab="coin"]').click();
            });
        });

        document.getElementById('rp-transaction-coin').addEventListener('change', (e) => {
            const symbol = e.target.value;
            if (!symbol) return;

            const portfolio = getPortfolio();
            const coinData = portfolio[symbol];

            if (!coinData || !coinData.transactions || coinData.transactions.length === 0) {
                document.getElementById('rp-transaction-history').innerHTML = `<p>No transactions found for ${symbol}</p>`;
                return;
            }

            let transactionsHTML = `
                <table class="rp-transaction-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            coinData.transactions.forEach(tx => {
                transactionsHTML += `
                    <tr>
                        <td>${formatDate(tx.date)}</td>
                        <td>${tx.type.toUpperCase()}</td>
                        <td>${formatNumberWithCommas(Math.abs(tx.quantity).toFixed(6))}</td>
                        <td>$${formatPrice(tx.price)}</td>
                        <td>$${formatNumberWithCommas((Math.abs(tx.quantity) * tx.price).toFixed(2))}</td>
                        <td>
                            <button class="rp-analyzer-button rp-delete"
                                data-symbol="${symbol}"
                                data-txid="${tx.id}"
                                data-action="delete-coin-tx">Delete</button>
                        </td>
                    </tr>
                `;
            });

            transactionsHTML += `
                    </tbody>
                </table>
            `;
            document.getElementById('rp-transaction-history').innerHTML = transactionsHTML;
    setTimeout(() => {
        setupSettingsTabEventListeners();
    }, 100);
            // Enhanced transaction deletion handler for coin transactions
            document.querySelectorAll('[data-action="delete-coin-tx"]').forEach(button => {
                button.addEventListener('click', () => {
                    const symbol = button.dataset.symbol;
                    const txId = button.dataset.txid;

                    console.log(`Delete button clicked for ${symbol} transaction ${txId}`);

                    showConfirmModal(
                        'Delete Transaction',
                        `Are you sure you want to delete this ${symbol} transaction? This action cannot be undone.`,
                        () => {
                            console.log(`Confirmed deletion of ${symbol} transaction ${txId}`);

                            const success = deleteTransaction(symbol, txId);

                            if (success) {
                                showNotification('Transaction deleted successfully', 'success');
                                // Refresh the transaction history
                                console.log('Refreshing transaction view...');

                                // Use setTimeout to ensure the DOM updates
                                setTimeout(() => {
                                    try {
                                        document.getElementById('rp-transaction-coin').dispatchEvent(new Event('change'));
                                        // Also update portfolio display
                                        updatePortfolioTab();
                                    } catch (error) {
                                        console.error('Error refreshing view:', error);
                                        showNotification('Error refreshing view: ' + error.message, 'error');
                                    }
                                }, 500);
                            } else {
                                showNotification('Failed to delete transaction - check console for details', 'error');
                            }
                        }
                    );
                });
            });
        });
    };

// Update search tab content
const updateSearchTab = () => {
    const content = document.getElementById('rp-analyzer-content');

    content.innerHTML = `
        <div class="rp-analyzer-section">
            <div class="rp-analyzer-section-title">Search Coins</div>
            <input type="text" class="rp-analyzer-input" id="rp-search-input" placeholder="Enter coin name or symbol">
            <button class="rp-analyzer-button" id="rp-search-button">Search</button>
        </div>

        <div id="rp-search-results">
            <!-- Results will appear here -->
        </div>
    `;

    document.getElementById('rp-search-button').addEventListener('click', performSearch);
    document.getElementById('rp-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
};

// Perform search and display results
const performSearch = async () => {
    const searchTerm = document.getElementById('rp-search-input').value.trim();
    if (!searchTerm) {
        showNotification('Please enter a search term', 'error');
        return;
    }

    const resultsContainer = document.getElementById('rp-search-results');
    resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="width: 40px; height: 40px; margin: 0 auto; border: 4px solid #333; border-top: 4px solid #0df; border-radius: 50%; animation: rp-spin 1s linear infinite;"></div>
            <p style="margin-top: 15px;">Searching for "${searchTerm}"...</p>
        </div>
    `;

    try {
        const results = await searchCoins(searchTerm);

        if (!results.coins || results.coins.length === 0) {
            resultsContainer.innerHTML = `
                <div class="rp-empty-state">
                    <div class="rp-empty-state-icon">🔍</div>
                    <div>No Results Found</div>
                    <p>No coins found matching "${searchTerm}".</p>
                    <p>Try a different search term.</p>
                </div>
            `;
            return;
        }

        let resultsHTML = `
            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Search Results (${results.coins.length})</div>
                <table class="rp-transaction-table">
                    <thead>
                        <tr>
                            <th>Coin</th>
                            <th>Price</th>
                            <th>24h Change</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        results.coins.forEach(coin => {
            const changePercent = (coin.change24h / (coin.currentPrice - coin.change24h) * 100).toFixed(2);
            const direction = changePercent >= 0 ? 'positive' : 'negative';

            resultsHTML += `
                <tr>
                    <td>${coin.name} (${coin.symbol})</td>
                    <td>$${formatPrice(coin.currentPrice)}</td>
                    <td class="rp-${direction}">
                        ${changePercent >= 0 ? '+' : ''}${changePercent}%
                    </td>
                    <td>
                        <button class="rp-analyzer-button" data-symbol="${coin.symbol}" data-action="view-search">View</button>
                    </td>
                </tr>
            `;
        });

        resultsHTML += `
                    </tbody>
                </table>
            </div>
        `;

        resultsContainer.innerHTML = resultsHTML;

        // Add event listeners to the View buttons
        document.querySelectorAll('[data-action="view-search"]').forEach(button => {
            button.addEventListener('click', () => {
                const symbol = button.dataset.symbol;
                currentCoin = symbol;

                // Switch to coin tab and load data
                document.querySelector('[data-tab="coin"]').click();
            });
        });

    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Error</div>
                <p style="color: #f55;">Error searching for coins: ${error}</p>
                <button class="rp-analyzer-button" id="rp-retry-search">Retry</button>
            </div>
        `;

        document.getElementById('rp-retry-search').addEventListener('click', performSearch);
    }
};

// Current coin being viewed
let currentCoin = null;
let currentCoinData = null;
let currentHoldersData = null;

// Load coin data from API
const loadCoinData = async (symbol) => {
    try {
        // Fetch both coin data and holders data
        const [coinData, holdersData] = await Promise.all([
            fetchCoinData(symbol),
            fetchCoinHolders(symbol)
        ]);

        currentCoin = symbol;
        currentCoinData = coinData;
        currentHoldersData = holdersData;

        // Get portfolio data for this coin
        const holdings = calculateHoldings(symbol);

        const content = document.getElementById('rp-analyzer-content');

        const coin = coinData.coin;
        const price = coin.currentPrice;
        const change24h = coin.change24h;
        const changePercent = (change24h / (price - change24h) * 100).toFixed(2);
        const direction = changePercent >= 0 ? 'positive' : 'negative';

        // Calculate profit/loss if user has holdings
        let profitLoss = 0;
        let profitLossPercent = 0;

        if (holdings.quantity > 0) {
            profitLoss = holdings.quantity * (price - holdings.avgPrice);
            profitLossPercent = ((price / holdings.avgPrice) - 1) * 100;
        }

        // Analyze price trend
        const priceAnalysis = analyzePrice(coinData.candlestickData);

        // Analyze risk
        const riskAnalysis = analyzeRisk(coinData, holdersData);

        // Prepare UI
        content.innerHTML = `
            <div class="rp-prediction rp-${priceAnalysis.trend.toLowerCase()}">
                🔮 PREDICTION: ${priceAnalysis.trend} - ${priceAnalysis.message}
            </div>

            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">${coin.name} (${coin.symbol})</div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Current Price:</span>
                    <span class="rp-analyzer-value">$${formatPrice(price)}</span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">24h Change:</span>
                    <span class="rp-analyzer-value rp-${direction}">
                        ${changePercent >= 0 ? '+' : ''}${changePercent}%
                        ($${formatPrice(Math.abs(change24h))})
                    </span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Market Cap:</span>
                    <span class="rp-analyzer-value">$${formatNumber(coin.marketCap)}</span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">24h Volume:</span>
                    <span class="rp-analyzer-value">$${formatNumber(coin.volume24h)}</span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Circulating Supply:</span>
                    <span class="rp-analyzer-value">${formatNumberWithCommas(coin.circulatingSupply)} ${coin.symbol}</span>
                </div>
            </div>

            <div class="rp-risk-analysis">
                <div class="rp-risk-title rp-risk-${riskAnalysis.riskLevel.toLowerCase()}">
                    ⚠️ RUGPULL RISK: ${riskAnalysis.riskLevel} -
                    ${riskAnalysis.factors.map(f => f.factor + ` (+${f.score}%)`).join('; ')}
                </div>

                <div style="margin-top: 10px; margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">📋 RISK BREAKDOWN:</div>
                    ${riskAnalysis.factors.map(factor =>
                        `   ${factor.factor} (+${factor.score}%)`
                    ).join('<br>')}
                </div>

                <div style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">🏆 HOLDER ANALYSIS:</div>
                    ${riskAnalysis.holderAnalysis ? `
                        Top Holder: ${riskAnalysis.holderAnalysis.topHolder.toFixed(2)}%<br>
                        Top 5 Holders: ${riskAnalysis.holderAnalysis.top5Holders.toFixed(2)}%<br>
                        Pool Health: ${riskAnalysis.holderAnalysis.poolPercentage.toFixed(3)}% of supply
                    ` : 'Holder data not available'}
                </div>

                <div class="rp-recommendation rp-risk-${riskAnalysis.riskLevel.toLowerCase()}">
                    <div style="font-weight: bold; margin-bottom: 5px;">💡 RECOMMENDATION:</div>
                    ${riskAnalysis.recommendation}
                </div>
            </div>

            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Your Holdings</div>

                ${holdings.quantity > 0 ? `
                    <div class="rp-analyzer-data-row">
                        <span class="rp-analyzer-label">Quantity:</span>
                        <span class="rp-analyzer-value">${formatNumberWithCommas(holdings.quantity)} ${coin.symbol}</span>
                    </div>

                    <div class="rp-analyzer-data-row">
                        <span class="rp-analyzer-label">Average Cost:</span>
                        <span class="rp-analyzer-value">$${formatPrice(holdings.avgPrice)}</span>
                    </div>

                    <div class="rp-analyzer-data-row">
                        <span class="rp-analyzer-label">Current Value:</span>
                        <span class="rp-analyzer-value">$${formatNumberWithCommas((holdings.quantity * price).toFixed(2))}</span>
                    </div>

                    <div class="rp-analyzer-data-row">
                        <span class="rp-analyzer-label">Profit/Loss:</span>
                        <span class="rp-analyzer-value rp-${profitLoss >= 0 ? 'positive' : 'negative'}">
                            ${profitLoss >= 0 ? '+' : ''}$${formatNumberWithCommas(profitLoss.toFixed(2))}
                            (${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(2)}%)
                        </span>
                    </div>
                ` : `
                    <p>You don't have any holdings for this coin yet.</p>
                `}

                <div style="margin-top: 15px;">
                    <div class="rp-analyzer-section-title">Add Transaction</div>
                    <input type="number" class="rp-analyzer-input" id="rp-transaction-quantity" placeholder="Quantity (positive for buy, negative for sell)">
                    <input type="number" class="rp-analyzer-input" id="rp-transaction-price" placeholder="Price per coin in USD">
                    <button class="rp-analyzer-button" id="rp-add-transaction">Add Transaction</button>
                </div>
            </div>

            <div class="rp-analyzer-section">
                <div class="rp-analyzer-section-title">Market Analysis</div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Volume/Market Cap Ratio:</span>
                    <span class="rp-analyzer-value">${(coin.volume24h / coin.marketCap * 100).toFixed(2)}%</span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Liquidity:</span>
                    <span class="rp-analyzer-value">$${formatNumber(coin.poolBaseCurrencyAmount)}</span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Created:</span>
                    <span class="rp-analyzer-value">${formatDate(coin.createdAt)}</span>
                </div>

                <div class="rp-analyzer-data-row">
                    <span class="rp-analyzer-label">Creator:</span>
                    <span class="rp-analyzer-value">${coin.creatorName}</span>
                </div>
            </div>
        `;

        // Add event listener for the transaction button
        document.getElementById('rp-add-transaction').addEventListener('click', () => {
            const quantity = document.getElementById('rp-transaction-quantity').value;
            const price = document.getElementById('rp-transaction-price').value;

            if (!quantity || !price) {
                showNotification('Please enter both quantity and price', 'error');
                return;
            }

            addTransaction(symbol, quantity, price);
            showNotification('Transaction added successfully', 'success');
            updateCoinTab(); // Refresh the UI
        });

    } catch (error) {
        console.error('Error loading coin data:', error);
        throw new Error('Failed to load coin data. Please check your API key and network connection.');
    }
};

// Show notification
const showNotification = (message, type = 'success') => {
    // Remove existing notification if present
    const existingNotification = document.querySelector('.rp-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.className = `rp-notification rp-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
};

    // Show confirmation modal

// ===========================
// Utility Functions
// ===========================

// Format price with appropriate decimal places
const formatPrice = (price) => {
    if (price >= 1000) {
        return price.toFixed(2);
    } else if (price >= 1) {
        return price.toFixed(4);
    } else if (price >= 0.01) {
        return price.toFixed(5);
    } else if (price >= 0.0001) {
        return price.toFixed(6);
    } else if (price >= 0.000001) {
        return price.toFixed(8);
    } else {
        return price.toExponential(4);
    }
};

// Format large numbers with suffix
const formatNumber = (num) => {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    } else {
        return num.toFixed(2);
    }
};
// Format numbers with commas
const formatNumberWithCommas = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Format date
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
};

// Update UI (general purpose refresh)
const updateUI = () => {
    // Get active tab
    const activeTab = document.querySelector('.rp-analyzer-tab.active');
    if (activeTab) {
        switchTab(activeTab);
    }
};

// ===========================
// Initialization
// ===========================

// Initialize the script
const init = () => {
    // Add styles first
    addStyles();

    // Check if we're on a RugPlay page
    if (window.location.hostname.includes('rugplay.com')) {
        createUI();

        // Ensure the toggle button exists (to fix the disappearing button issue)
        if (!document.getElementById('rp-toggle-button')) {
            createToggleButton();
        }

        // Auto-detect coin from URL
        const symbol = getCoinFromUrl();
        if (symbol) {
            currentCoin = symbol;

            // Auto-open analyzer when on a coin page
            setTimeout(() => {
                const container = document.getElementById('rp-analyzer-container');
                if (container && container.style.display === 'none') {
                    toggleAnalyzer();
                }
            }, 1000);
        }

        // Set up mutation observer to detect URL changes (for single-page apps)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;

                // Make sure the toggle button is always visible
                if (!document.getElementById('rp-toggle-button')) {
                    createToggleButton();
                }

                const newSymbol = getCoinFromUrl();
                if (newSymbol && newSymbol !== currentCoin) {
                    currentCoin = newSymbol;
                    if (document.getElementById('rp-analyzer-container').style.display !== 'none') {
                        updateCoinTab();
                    }
                }
            }
        }).observe(document, {subtree: true, childList: true});
    }
};

// Start the script when the page is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Add a periodic check to ensure the toggle button always exists
setInterval(() => {
    if (!document.getElementById('rp-toggle-button')) {
        createToggleButton();
    }
}, 5000);
    })();