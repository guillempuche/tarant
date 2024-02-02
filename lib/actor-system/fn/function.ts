// /**
//  * Copyright (c) 2018-present, tarant
//  *
//  * This source code is licensed under the MIT license found in the
//  * LICENSE file in the root directory of this source tree.
//  */

// import Actor, { ActorConstructor } from '../actor'
// import ActorSystem from '../actor-system'

// // export type FunctionActorConstructor<T> = (constructor: ActorConstructor) => Promise<T>

// export default class FunctionActor<T> extends Actor {
//   public static for<K>(
//     system: ActorSystem,
//     // fn: FunctionActorConstructor<T>,
//     fn: any,
//   ): (constructor: ActorConstructor) => Promise<K> {
//     const actor = system.actorOf(FunctionActor, fn)

//     return function () {
//       return actor.execute<K>(fn)
//     }
//   }

//   // private fn: FunctionActorConstructor<T>
//   private fn: any

//   // constructor(fn: FunctionActorConstructor<T>) {
//   constructor(fn: any) {
//     super()
//     this.fn = fn
//   }

//   public async execute<T>(constructor: ActorConstructor): Promise<T> {
//     return await this.fn(constructor)
//   }
// }
