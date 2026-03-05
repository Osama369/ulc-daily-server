import User from "../models/User.js";
import mongoose from 'mongoose';
import Transfer from "../models/Transfer.js";

const getAllUsers = async (req, res) => {   // admin will see all users at admin panel
  try {
    const users = await User.find({
      role: { $ne: 'admin' },        // Exclude admin users
      dealerId: { $ne: "XNHIL897" }  // Exclude specific dealer
    }).select("-password -__v");
    
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createUser = async (req, res) => {  // admin creates distributor
  const { username, password, dealerId, city , phone , email, balance, singleFigure, doubleFigure, tripleFigure, fourFigure, commission,
    hinsaMultiplier, akraMultiplier, tandolaMultiplier, pangoraMultiplier } = req.body;
  const role = 'distributor';
  const createdBy = req.user.id; // admin id
  try {
    // Allow admin to assign initial balance when creating a distributor
    const initialBalance = Number(balance || 0);
    if (Number.isNaN(initialBalance) || initialBalance < 0) {
      return res.status(400).json({ error: 'Invalid balance' });
    }

    const user = new User({
      username,
      password,
      city,
      dealerId,
      phone,
      email,
      role,
      balance: initialBalance,
      singleFigure,
      doubleFigure,
      tripleFigure,
      fourFigure,
      commission,
      hinsaMultiplier,
      akraMultiplier,
      tandolaMultiplier,
      pangoraMultiplier,
      createdBy,
    });

    await user.save();
    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(201).json({ message: "Distributor created successfully", user: userResponse });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getUserById = async (req, res) => {  // getUser only for user to get profile
  const { id } = req.params;
  try {
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    return res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const updatedUserData = req.body;
  if (!updatedUserData) {
    return res.status(400).json({
      message: "Invalid user data",
    });
  }
  try {
    // const updatedUser = await User.findByIdAndUpdate(id, updatedUserData, {
    //   new: true,
    // }).select("-password");
    // if (!updatedUser) {
    //   return res.status(404).json({
    //     message: "User not found",
    //   });
    // }
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    
    // Previously, when a distributor increased a client's balance, we
    // deducted the difference from the distributor's own balance.
    // Business rule updated: distributor balance should NOT be affected
    // when assigning or updating client balances, so that logic is removed.
    // Prevent privilege/escalation: do not allow updating `role` or `createdBy` via this admin route
    if (updatedUserData.hasOwnProperty('role')) delete updatedUserData.role;
    if (updatedUserData.hasOwnProperty('createdBy')) delete updatedUserData.createdBy;

    // If admin is attempting to change `balance`, ensure they can only modify
    // distributors they themselves created. This prevents an admin from
    // arbitrarily altering balances of other admins/distributors.
    if (updatedUserData.hasOwnProperty('balance') && req.user.role === 'admin') {
      if (user.role !== 'distributor' || !user.createdBy || String(user.createdBy) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Admin can only modify balance for distributors they created' });
      }
    }

    // Update fields
    Object.keys(updatedUserData).forEach(key => {
      user[key] = updatedUserData[key];
    });
    
    // Save the user (this will trigger the pre-save hooks)
    await user.save();
    
    // Return the user without password
    const userResponse = user.toObject();
    delete userResponse.password;
    
    return res.status(200).json(userResponse);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deleting admin accounts via this route
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }

    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const toggleUserActiveStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    user.isActive = !user.isActive;
    await user.save();
    return res.status(200).json({
      message: "User active status updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const initializeUserBalance = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    // If caller is admin, restrict initialization to distributors created by this admin
    if (req.user.role === 'admin') {
      if (user.role !== 'distributor' || !user.createdBy || String(user.createdBy) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Admin can only initialize balance for distributors they created' });
      }
    }

    user.balance = (user.balance || 0) + Number(amount || 0);
    await user.save();
    return res.status(200).json({ message: "User balance initialized successfully", balance: user.balance });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deductUserBalance = async (req, res) => { // this would be call in user profile 
  const { id } = req.params;
  const { amount } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    user.balance -= amount;
    await user.save();
    return res.status(200).json({
      message: "User balance deducted successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const suspendedUsers = async (req, res) =>{
  try {
    const users = await User.find({isActive : false}).select("-password");
    return res.json(users);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

const activeUsers = async (req, res) =>{
  try {
    const users = await User.find({isActive : true}).select("-password");
    return res.json(users);
  } catch (error) {
    return res.status(400).json({ error: error.message });  
  }
}

const getDistributorUsers = async (req, res) => {
  try {
    // Get the distributor ID from the authenticated user
    const distributorId = req.user.id;
    // Find all users created by this distributor
    const users = await User.find({
      createdBy: distributorId,
      role: 'user'
    }).select("-password -__v");
    
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getDistributorParties = async (req, res) => {
  try {
    const distributorId = req.user.id;
    const parties = await User.find({ createdBy: distributorId, role: 'party' }).select('-password -__v');
    res.json(parties);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createDistributorUser = async (req, res) => { 
  const { username, password, dealerId, city , phone , email, balance, singleFigure, doubleFigure, tripleFigure, fourFigure, commission,
    hinsaMultiplier, akraMultiplier, tandolaMultiplier, pangoraMultiplier, partyCode, accountType } = req.body;
  // accountType: 'user' | 'party' - default to user (client)
  const role = accountType === 'party' ? 'party' : 'user';
  const createdBy = req.user.id; // Get the distributor ID from the authenticated user
  try {
    // Old behavior: check distributor balance and deduct `balance` from
    // distributor when creating a client. New rule: distributor can assign
    // any starting balance to the client without reducing their own balance,
    // so we no longer check or modify dealer.balance here.
    // If creating a party account, ensure partyCode is provided and unique
    if(role === 'party'){
      if(!partyCode) return res.status(400).json({ error: 'partyCode is required for party accounts' });
      const exists = await User.findOne({ partyCode });
      if(exists) return res.status(400).json({ error: 'partyCode already in use' });
    }
    // If distributor wants to assign starting balance, deduct from distributor atomically
    const amt = Number(balance || 0);
    if (Number.isNaN(amt) || amt < 0) return res.status(400).json({ error: 'Invalid balance amount' });

    // Fallback atomic approach without transactions: decrement distributor balance atomically then create user.
    let senderAfter = null;
    if (req.user.role === 'distributor' && amt > 0) {
      senderAfter = await User.findOneAndUpdate(
        { _id: req.user.id, balance: { $gte: amt } },
        { $inc: { balance: -amt } },
        { new: true }
      );
      if (!senderAfter) return res.status(400).json({ error: 'Insufficient distributor balance' });
    }

    try {
      const user = new User({
        username,
        password,
        city,
        dealerId,
        phone,
        email,
        role,
        balance: amt,
        singleFigure,
        doubleFigure,
        tripleFigure,
        fourFigure,
        commission,
        hinsaMultiplier,
        akraMultiplier,
        tandolaMultiplier,
        pangoraMultiplier,
        createdBy,
        partyCode,
      }); 
      await user.save();
      const userResponse = user.toObject();
      delete userResponse.password;
      return res.status(201).json({ message: "Distributor user created successfully", user: userResponse, senderBalance: senderAfter ? senderAfter.balance : undefined });
    } catch (err) {
      // If we already deducted from distributor but user creation failed, attempt refund
      if (senderAfter && amt > 0) {
        try {
          await User.findByIdAndUpdate(req.user.id, { $inc: { balance: amt } });
        } catch (refundErr) {
          console.error('Failed to refund distributor after client create failure:', refundErr);
        }
      }
      return res.status(400).json({ error: err.message });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Transfer balance from the authenticated user (distributor) to another user (client)
const transferBalanceBetweenUsers = async (req, res) => {
  const { id: targetUserId } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'A positive amount is required' });

  try {
    // Only distributors (and admins) can transfer in this flow
    const senderRole = req.user.role;
    const ownerAdminId = String(process.env.OWNER_ADMIN_ID || '').trim();
    const isUnlimitedOwnerAdmin =
      senderRole === 'admin' &&
      ownerAdminId &&
      String(req.user.id) === ownerAdminId;
    if (senderRole !== 'distributor' && senderRole !== 'admin') {
      return res.status(403).json({ error: 'Only distributors or admins can perform transfers' });
    }

    // Non-transactional atomic decrement + credit with transfer record
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    // Validate target and ownership before mutating sender
    const target = await User.findById(targetUserId);
    if (!target) return res.status(404).json({ error: 'Target user not found' });

    if (senderRole === 'distributor') {
      if (!target.createdBy || String(target.createdBy) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Distributors can only transfer to their own clients' });
      }
      if (target.role === 'distributor' || target.role === 'admin') {
        return res.status(403).json({ error: 'Invalid target for distributor transfer' });
      }
    }

    if (senderRole === 'admin') {
      // Owner admin can transfer to any distributor without sender balance deduction.
      if (isUnlimitedOwnerAdmin) {
        if (target.role !== 'distributor') {
          return res.status(403).json({ error: 'Owner admin can only transfer to distributor accounts' });
        }
      } else {
        if (target.role !== 'distributor' || !target.createdBy || String(target.createdBy) !== String(req.user.id)) {
          return res.status(403).json({ error: 'Admin can only transfer to distributors they created' });
        }
      }
    }

    // Idempotency handling: if client provides an `Idempotency-Key` avoid duplicate execution
    let tx = null;
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    if (idempotencyKey) {
      // Look up existing transfer by key (race-safe)
      let existing = await Transfer.findOne({ idempotencyKey });
      if (existing) {
        // If core payload differs for same idempotency key, treat as conflict
        if (String(existing.from) !== String(req.user.id) || String(existing.to) !== String(targetUserId) || existing.amount !== amt) {
          return res.status(409).json({ error: 'Idempotency key conflict: different payload' });
        }
        if (existing.status === 'done') {
          const senderNow = await User.findById(req.user.id).select('balance');
          const targetNow = await User.findById(targetUserId).select('balance');
          return res.status(200).json({ message: 'Transfer already completed', senderBalance: senderNow.balance, targetBalance: targetNow.balance });
        }
        if (existing.status === 'pending') {
          return res.status(202).json({ message: 'Transfer is pending' });
        }
        // existing.status === 'failed' -> prepare to retry using this record
        existing.attempts = (existing.attempts || 0) + 1;
        existing.status = 'pending';
        await existing.save();
        tx = existing;
      }
    }

    // Create transfer record for audit/reconciliation if not present
    if (!tx) {
      try {
        tx = await Transfer.create({
          from: req.user.id,
          to: targetUserId,
          amount: amt,
          status: 'pending',
          idempotencyKey,
          meta: { unlimitedByOwnerAdmin: !!isUnlimitedOwnerAdmin },
        });
      } catch (createErr) {
        // Duplicate-key race: another request may have created the same idempotency record concurrently
        if (createErr && createErr.code === 11000 && idempotencyKey) {
          const existing = await Transfer.findOne({ idempotencyKey });
          if (existing) {
            if (String(existing.from) !== String(req.user.id) || String(existing.to) !== String(targetUserId) || existing.amount !== amt) {
              return res.status(409).json({ error: 'Idempotency key conflict: different payload' });
            }
            if (existing.status === 'done') {
              const senderNow = await User.findById(req.user.id).select('balance');
              const targetNow = await User.findById(targetUserId).select('balance');
              return res.status(200).json({ message: 'Transfer already completed', senderBalance: senderNow.balance, targetBalance: targetNow.balance });
            }
            if (existing.status === 'pending') {
              return res.status(202).json({ message: 'Transfer is pending' });
            }
            existing.attempts = (existing.attempts || 0) + 1;
            existing.status = 'pending';
            await existing.save();
            tx = existing;
          }
        } else {
          throw createErr;
        }
      }
    }

    try {
      const shouldDeductSender = !isUnlimitedOwnerAdmin;
      let sender = null;

      if (shouldDeductSender) {
        // Regular distributor/admin flow: atomically decrement sender first.
        sender = await User.findOneAndUpdate(
          { _id: req.user.id, balance: { $gte: amt } },
          { $inc: { balance: -amt } },
          { new: true }
        );
        if (!sender) {
          await Transfer.findByIdAndUpdate(tx._id, { status: 'failed', attempts: (tx.attempts||0) + 1 });
          return res.status(400).json({ error: 'Insufficient balance' });
        }
      } else {
        // Owner admin unlimited flow: keep sender balance unchanged.
        sender = await User.findById(req.user.id).select('balance');
      }

      // Credit target
      const updatedTarget = await User.findByIdAndUpdate(targetUserId, { $inc: { balance: amt } }, { new: true });
      if (!updatedTarget) {
        // Attempt refund only when sender was actually deducted.
        if (shouldDeductSender) {
          try {
            await User.findByIdAndUpdate(req.user.id, { $inc: { balance: amt } });
          } catch (refundErr) {
            console.error('Failed to refund after partial transfer failure:', refundErr);
          }
        }
        await Transfer.findByIdAndUpdate(tx._id, { status: 'failed', attempts: (tx.attempts||0) + 1 });
        return res.status(500).json({ error: 'Failed to credit target user' });
      }

      await Transfer.findByIdAndUpdate(tx._id, {
        status: 'done',
        completedAt: new Date(),
        meta: { ...(tx.meta || {}), unlimitedByOwnerAdmin: !!isUnlimitedOwnerAdmin },
      });
      return res.status(200).json({
        message: 'Transfer successful',
        senderBalance: sender?.balance,
        targetBalance: updatedTarget.balance,
      });
    } catch (err) {
      await Transfer.findByIdAndUpdate(tx._id, { status: 'failed', attempts: (tx.attempts||0) + 1 });
      return res.status(500).json({ error: err.message });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Distributor can delete users they created (party accounts)
const distributorDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // only allow distributor who created this user to delete
    if (String(user.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this user' });
    }
    await User.findByIdAndDelete(id);
    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Distributor can update some fields of users they created
const distributorUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (String(user.createdBy) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this user' });
    }
    // Prevent changing role or createdBy
    delete updates.role;
    delete updates.createdBy;
    // Apply updates
    Object.keys(updates).forEach(key => {
      user[key] = updates[key];
    });
    await user.save();
    const userResponse = user.toObject();
    delete userResponse.password;
    return res.status(200).json(userResponse);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserActiveStatus, 
  initializeUserBalance,
  deductUserBalance,
  getDistributorUsers,
  createDistributorUser,
  distributorDeleteUser,
  distributorUpdateUser,
  getDistributorParties,
  transferBalanceBetweenUsers,
};

