


// const authProviderSchema = new mongoose.Schema<IAuthProvider>({
//     provider: { type: String, required: true },
//     providerId: { type: String, required: true }
// }, {
//     _id: false,
//     versionKey: false
// });



// const userSchema = new mongoose.Schema<IUser>({
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true, lowercase:true },
//     password: { type: String },
//     picture: { type: String},
//     otp: { type: String, default: 0 },
//     isVerified: { type: Boolean, default: false },
//     role: { type: String, enum: [...Object.values(Role)], default: Role.USER },
//     auths: [authProviderSchema]
// }, {
//     versionKey: false,
//     timestamps: true
// });


// // Hashed password
// userSchema.pre("save", async function(next) {
//      if (!this?.password) next();
//      const hashedPassword = await bcrypt.hash(this?.password as string, parseInt(env?.BCRYPT_SALT_ROUND));
//      this.password = hashedPassword;
//      next();
// });




// const User = mongoose.model<IUser>("user", userSchema);

// export default User;