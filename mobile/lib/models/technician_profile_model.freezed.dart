// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'technician_profile_model.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$TechnicianProfileModel {

 int get id; int get userId; String? get status; int? get pointsBalance; int? get reservedPoints; int? get yearsOfExperience;
/// Create a copy of TechnicianProfileModel
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TechnicianProfileModelCopyWith<TechnicianProfileModel> get copyWith => _$TechnicianProfileModelCopyWithImpl<TechnicianProfileModel>(this as TechnicianProfileModel, _$identity);

  /// Serializes this TechnicianProfileModel to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TechnicianProfileModel&&(identical(other.id, id) || other.id == id)&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.status, status) || other.status == status)&&(identical(other.pointsBalance, pointsBalance) || other.pointsBalance == pointsBalance)&&(identical(other.reservedPoints, reservedPoints) || other.reservedPoints == reservedPoints)&&(identical(other.yearsOfExperience, yearsOfExperience) || other.yearsOfExperience == yearsOfExperience));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,userId,status,pointsBalance,reservedPoints,yearsOfExperience);

@override
String toString() {
  return 'TechnicianProfileModel(id: $id, userId: $userId, status: $status, pointsBalance: $pointsBalance, reservedPoints: $reservedPoints, yearsOfExperience: $yearsOfExperience)';
}


}

/// @nodoc
abstract mixin class $TechnicianProfileModelCopyWith<$Res>  {
  factory $TechnicianProfileModelCopyWith(TechnicianProfileModel value, $Res Function(TechnicianProfileModel) _then) = _$TechnicianProfileModelCopyWithImpl;
@useResult
$Res call({
 int id, int userId, String? status, int? pointsBalance, int? reservedPoints, int? yearsOfExperience
});




}
/// @nodoc
class _$TechnicianProfileModelCopyWithImpl<$Res>
    implements $TechnicianProfileModelCopyWith<$Res> {
  _$TechnicianProfileModelCopyWithImpl(this._self, this._then);

  final TechnicianProfileModel _self;
  final $Res Function(TechnicianProfileModel) _then;

/// Create a copy of TechnicianProfileModel
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? userId = null,Object? status = freezed,Object? pointsBalance = freezed,Object? reservedPoints = freezed,Object? yearsOfExperience = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as int,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,pointsBalance: freezed == pointsBalance ? _self.pointsBalance : pointsBalance // ignore: cast_nullable_to_non_nullable
as int?,reservedPoints: freezed == reservedPoints ? _self.reservedPoints : reservedPoints // ignore: cast_nullable_to_non_nullable
as int?,yearsOfExperience: freezed == yearsOfExperience ? _self.yearsOfExperience : yearsOfExperience // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [TechnicianProfileModel].
extension TechnicianProfileModelPatterns on TechnicianProfileModel {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TechnicianProfileModel value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TechnicianProfileModel() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TechnicianProfileModel value)  $default,){
final _that = this;
switch (_that) {
case _TechnicianProfileModel():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TechnicianProfileModel value)?  $default,){
final _that = this;
switch (_that) {
case _TechnicianProfileModel() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  int userId,  String? status,  int? pointsBalance,  int? reservedPoints,  int? yearsOfExperience)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TechnicianProfileModel() when $default != null:
return $default(_that.id,_that.userId,_that.status,_that.pointsBalance,_that.reservedPoints,_that.yearsOfExperience);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  int userId,  String? status,  int? pointsBalance,  int? reservedPoints,  int? yearsOfExperience)  $default,) {final _that = this;
switch (_that) {
case _TechnicianProfileModel():
return $default(_that.id,_that.userId,_that.status,_that.pointsBalance,_that.reservedPoints,_that.yearsOfExperience);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  int userId,  String? status,  int? pointsBalance,  int? reservedPoints,  int? yearsOfExperience)?  $default,) {final _that = this;
switch (_that) {
case _TechnicianProfileModel() when $default != null:
return $default(_that.id,_that.userId,_that.status,_that.pointsBalance,_that.reservedPoints,_that.yearsOfExperience);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TechnicianProfileModel implements TechnicianProfileModel {
  const _TechnicianProfileModel({required this.id, required this.userId, this.status, this.pointsBalance, this.reservedPoints, this.yearsOfExperience});
  factory _TechnicianProfileModel.fromJson(Map<String, dynamic> json) => _$TechnicianProfileModelFromJson(json);

@override final  int id;
@override final  int userId;
@override final  String? status;
@override final  int? pointsBalance;
@override final  int? reservedPoints;
@override final  int? yearsOfExperience;

/// Create a copy of TechnicianProfileModel
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TechnicianProfileModelCopyWith<_TechnicianProfileModel> get copyWith => __$TechnicianProfileModelCopyWithImpl<_TechnicianProfileModel>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TechnicianProfileModelToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TechnicianProfileModel&&(identical(other.id, id) || other.id == id)&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.status, status) || other.status == status)&&(identical(other.pointsBalance, pointsBalance) || other.pointsBalance == pointsBalance)&&(identical(other.reservedPoints, reservedPoints) || other.reservedPoints == reservedPoints)&&(identical(other.yearsOfExperience, yearsOfExperience) || other.yearsOfExperience == yearsOfExperience));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,userId,status,pointsBalance,reservedPoints,yearsOfExperience);

@override
String toString() {
  return 'TechnicianProfileModel(id: $id, userId: $userId, status: $status, pointsBalance: $pointsBalance, reservedPoints: $reservedPoints, yearsOfExperience: $yearsOfExperience)';
}


}

/// @nodoc
abstract mixin class _$TechnicianProfileModelCopyWith<$Res> implements $TechnicianProfileModelCopyWith<$Res> {
  factory _$TechnicianProfileModelCopyWith(_TechnicianProfileModel value, $Res Function(_TechnicianProfileModel) _then) = __$TechnicianProfileModelCopyWithImpl;
@override @useResult
$Res call({
 int id, int userId, String? status, int? pointsBalance, int? reservedPoints, int? yearsOfExperience
});




}
/// @nodoc
class __$TechnicianProfileModelCopyWithImpl<$Res>
    implements _$TechnicianProfileModelCopyWith<$Res> {
  __$TechnicianProfileModelCopyWithImpl(this._self, this._then);

  final _TechnicianProfileModel _self;
  final $Res Function(_TechnicianProfileModel) _then;

/// Create a copy of TechnicianProfileModel
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? userId = null,Object? status = freezed,Object? pointsBalance = freezed,Object? reservedPoints = freezed,Object? yearsOfExperience = freezed,}) {
  return _then(_TechnicianProfileModel(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as int,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String?,pointsBalance: freezed == pointsBalance ? _self.pointsBalance : pointsBalance // ignore: cast_nullable_to_non_nullable
as int?,reservedPoints: freezed == reservedPoints ? _self.reservedPoints : reservedPoints // ignore: cast_nullable_to_non_nullable
as int?,yearsOfExperience: freezed == yearsOfExperience ? _self.yearsOfExperience : yearsOfExperience // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
